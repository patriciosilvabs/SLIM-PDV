"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.kdsData = exports.kdsDeviceAuth = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
const KDS_DEVICE_ONLINE_WINDOW_MS = 30 * 1000;
const KDS_CLAIM_TTL_MS = 30 * 1000;
const DEFAULT_KDS_DEVICE_STAGE_COLOR = "#3B82F6";
const DEFAULT_KDS_DEVICE_STAGE_ICON = "ChefHat";
function cors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}
function handlePreflight(req, res) {
    cors(res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
}
function json(res, status, body) {
    cors(res);
    res.status(status).json(body);
}
async function requireAuth(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        json(res, 401, { error: "Autorizacao nao fornecida" });
        return null;
    }
    const token = authHeader.slice("Bearer ".length);
    try {
        return await (0, auth_1.getAuth)().verifyIdToken(token);
    }
    catch (error) {
        logger.error("Token validation failed", error);
        json(res, 401, { error: "Usuario nao autenticado" });
        return null;
    }
}
function asTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function asNullableString(value) {
    const normalized = asTrimmedString(value);
    return normalized || null;
}
function asNullableNumber(value) {
    const normalized = typeof value === "number" ? value : Number(value);
    return Number.isFinite(normalized) ? normalized : null;
}
function asNumber(value, fallback = 0) {
    const normalized = asNullableNumber(value);
    return normalized ?? fallback;
}
function isRecentIso(iso, ttlMs) {
    if (!iso)
        return false;
    const timestamp = new Date(iso).getTime();
    return Number.isFinite(timestamp) && Date.now() - timestamp < ttlMs;
}
function asStringArray(value, fallback = []) {
    if (!Array.isArray(value))
        return fallback;
    return value
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function chunkStrings(values, size = 10) {
    const chunks = [];
    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }
    return chunks;
}
function docRow(snap) {
    return {
        id: snap.id,
        data: (snap.data() ?? {}),
    };
}
function sortByIsoAsc(rows) {
    return [...rows].sort((left, right) => asTrimmedString(left.created_at).localeCompare(asTrimmedString(right.created_at)));
}
function sortByIsoDesc(rows) {
    return [...rows].sort((left, right) => asTrimmedString(right.created_at).localeCompare(asTrimmedString(left.created_at)));
}
function getTenantIdFromSubcollectionDoc(snap) {
    return snap.ref.parent.parent?.id ?? asTrimmedString(snap.data()?.tenant_id);
}
function sanitizeKdsDevice(id, tenantId, data) {
    const sanitized = { ...data };
    delete sanitized.auth_code;
    delete sanitized.verification_code;
    delete sanitized.password_hash;
    return {
        id,
        ...sanitized,
        tenant_id: asTrimmedString(sanitized.tenant_id) || tenantId,
    };
}
function isDeletedKdsDeviceData(data) {
    return !!asNullableString(data.deleted_at);
}
async function requireTenantAccess(req, res, tenantId) {
    const caller = await requireAuth(req, res);
    if (!caller)
        return null;
    const firestore = (0, firestore_1.getFirestore)();
    const tenantRef = firestore.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists) {
        json(res, 404, { error: "Tenant nao encontrado" });
        return null;
    }
    const tenantData = (tenantSnap.data() ?? {});
    if (asTrimmedString(tenantData.owner_id) === caller.uid) {
        return { caller, firestore, tenantRef };
    }
    const membershipSnap = await tenantRef.collection("tenant_members").doc(caller.uid).get();
    if (!membershipSnap.exists) {
        const legacyMembershipSnap = await firestore.collection("tenant_memberships").doc(`${tenantId}_${caller.uid}`).get();
        if (!legacyMembershipSnap.exists) {
            json(res, 403, { error: "Usuario nao possui acesso a este tenant" });
            return null;
        }
    }
    return { caller, firestore, tenantRef };
}
function normalizeStationType(value) {
    const stationType = asTrimmedString(value) || "custom";
    const validStationTypes = new Set([
        "prep_start",
        "item_assembly",
        "assembly",
        "oven_expedite",
        "order_status",
        "custom",
    ]);
    return validStationTypes.has(stationType) ? stationType : "custom";
}
function normalizeStationIcon(value) {
    return asTrimmedString(value) || "ChefHat";
}
function normalizeStationColor(value) {
    return asTrimmedString(value) || "#3B82F6";
}
function normalizeDeviceRoutingMode(value) {
    const normalized = asTrimmedString(value);
    return normalized === "keywords" ? "keywords" : "default";
}
function normalizeDeviceStageType(value) {
    return normalizeStationType(value);
}
function normalizeDeviceDisplayOrder(value, fallback = 0) {
    return asNullableNumber(value) ?? fallback;
}
function normalizeDeviceRoutingKeywords(value) {
    return asStringArray(value)
        .map((keyword) => keyword.toLowerCase())
        .filter(Boolean);
}
function normalizeDeviceNextIds(value, fallback) {
    const nextIds = asStringArray(value)
        .map((deviceId) => deviceId.trim())
        .filter(Boolean);
    if (nextIds.length) {
        return Array.from(new Set(nextIds));
    }
    const legacyId = asNullableString(fallback);
    return legacyId ? [legacyId] : [];
}
function inferLegacyEntryDevice(stationType) {
    return stationType === "item_assembly" || stationType === "prep_start" || stationType === "assembly";
}
function resolveKdsDeviceRow(row, stationMap) {
    const stationId = asNullableString(row.data.station_id);
    const stationTypeFromStage = stationId ? asNullableString(stationMap.get(stationId)?.station_type) : null;
    const stageType = normalizeDeviceStageType(row.data.stage_type ?? stationTypeFromStage);
    const displayOrder = normalizeDeviceDisplayOrder(row.data.display_order, stationId ? asNumber(stationMap.get(stationId)?.sort_order, 0) : 0);
    const isTerminal = row.data.is_terminal === true;
    const nextDeviceIds = isTerminal ? [] : normalizeDeviceNextIds(row.data.next_device_ids, row.data.next_device_id);
    return {
        id: row.id,
        device_id: asTrimmedString(row.data.device_id),
        name: asTrimmedString(row.data.name),
        station_id: stationId,
        station_type: stageType,
        stage_type: stageType,
        display_order: displayOrder,
        routing_mode: normalizeDeviceRoutingMode(row.data.routing_mode),
        routing_keywords: normalizeDeviceRoutingKeywords(row.data.routing_keywords),
        is_entry_device: typeof row.data.is_entry_device === "boolean"
            ? Boolean(row.data.is_entry_device)
            : inferLegacyEntryDevice(stageType),
        is_terminal: isTerminal,
        next_device_ids: nextDeviceIds,
        next_device_id: nextDeviceIds[0] ?? null,
        last_seen_at: asNullableString(row.data.last_seen_at),
        is_active: row.data.is_active !== false,
    };
}
function isResolvedDeviceOnline(device) {
    return isRecentIso(device.last_seen_at, KDS_DEVICE_ONLINE_WINDOW_MS);
}
function buildItemRoutingText(params) {
    const extrasText = (params.extras ?? [])
        .map((extra) => [
        asTrimmedString(extra.extra_name),
        asTrimmedString(extra.option_name),
        asTrimmedString(extra.kds_category),
    ]
        .filter(Boolean)
        .join(" "))
        .join(" ");
    const subExtrasText = (params.subExtras ?? [])
        .map((extra) => [
        asTrimmedString(extra.option_name),
        asTrimmedString(extra.kds_category),
    ]
        .filter(Boolean)
        .join(" "))
        .join(" ");
    const explicitBorder = [...(params.extras ?? []), ...(params.subExtras ?? [])].some((extra) => asTrimmedString(extra.kds_category) === "border");
    return `${asTrimmedString(params.notes)} ${extrasText} ${subExtrasText} ${explicitBorder ? "border borda" : ""}`
        .toLowerCase()
        .trim();
}
function filterEntryDevicesForItem(devices, itemRoutingText) {
    const entryDevices = devices.filter((device) => device.is_entry_device);
    if (!entryDevices.length)
        return [];
    const keywordDevices = entryDevices.filter((device) => device.routing_mode === "keywords" &&
        device.routing_keywords.length > 0 &&
        device.routing_keywords.some((keyword) => itemRoutingText.includes(keyword)));
    if (keywordDevices.length) {
        return keywordDevices;
    }
    const defaultDevices = entryDevices.filter((device) => device.routing_mode !== "keywords" || device.routing_keywords.length === 0);
    return defaultDevices;
}
function getFallbackDevicesFromEntryNextSteps(allDevices, onlineDevices) {
    const entryDevices = allDevices.filter((device) => device.is_entry_device);
    const fallbackNextIds = Array.from(new Set(entryDevices.flatMap((device) => device.next_device_ids).filter(Boolean)));
    if (!fallbackNextIds.length)
        return [];
    const allFallbackDevices = fallbackNextIds
        .map((deviceId) => allDevices.find((device) => device.device_id === deviceId) ?? null)
        .filter((device) => !!device);
    if (!allFallbackDevices.length)
        return [];
    const onlineFallbackIds = new Set(onlineDevices.map((device) => device.device_id));
    const onlineFallbackDevices = allFallbackDevices.filter((device) => onlineFallbackIds.has(device.device_id));
    return onlineFallbackDevices.length ? onlineFallbackDevices : allFallbackDevices;
}
function pickLeastLoadedDeviceId(devices, deviceLoadCounts, preferredDeviceId) {
    if (!devices.length)
        return null;
    if (preferredDeviceId && devices.some((device) => device.device_id === preferredDeviceId)) {
        return preferredDeviceId;
    }
    const selected = [...devices].sort((left, right) => {
        const leftLoad = deviceLoadCounts.get(left.device_id) ?? 0;
        const rightLoad = deviceLoadCounts.get(right.device_id) ?? 0;
        if (leftLoad !== rightLoad)
            return leftLoad - rightLoad;
        return left.device_id.localeCompare(right.device_id);
    })[0];
    return selected?.device_id ?? null;
}
function getCandidateEntryDevices(allDevices, onlineDevices, itemRoutingText) {
    const onlineCandidates = filterEntryDevicesForItem(onlineDevices, itemRoutingText);
    if (onlineCandidates.length) {
        return onlineCandidates;
    }
    const allCandidates = filterEntryDevicesForItem(allDevices, itemRoutingText);
    if (allCandidates.length) {
        return allCandidates;
    }
    const fallbackNextDevices = getFallbackDevicesFromEntryNextSteps(allDevices, onlineDevices);
    if (fallbackNextDevices.length) {
        return fallbackNextDevices;
    }
    return onlineDevices.length ? onlineDevices : allDevices;
}
function getCandidateDevicesForStations(stations, devicesByStation, onlineDevicesByStation) {
    const onlineCandidates = stations.flatMap((station) => onlineDevicesByStation.get(station.id) ?? []);
    if (onlineCandidates.length) {
        return onlineCandidates;
    }
    return stations.flatMap((station) => devicesByStation.get(station.id) ?? []);
}
function isActiveKdsItemForLoad(data) {
    if (asNullableString(data.cancelled_at) || asNullableString(data.served_at))
        return false;
    const itemStatus = asTrimmedString(data.status);
    if (itemStatus === "cancelled" || itemStatus === "delivered")
        return false;
    const stationStatus = asTrimmedString(data.station_status);
    return stationStatus === "waiting" || stationStatus === "in_progress";
}
async function getDeviceLoadCounts(tenantRef, deviceIds, excludeItemId) {
    const loadCounts = new Map();
    deviceIds.forEach((deviceId) => loadCounts.set(deviceId, 0));
    for (const chunk of chunkStrings(deviceIds)) {
        const snapshot = await tenantRef
            .collection("order_items")
            .where("current_device_id", "in", chunk)
            .get();
        snapshot.docs.forEach((docSnap) => {
            if (excludeItemId && docSnap.id === excludeItemId)
                return;
            const data = (docSnap.data() ?? {});
            if (!isActiveKdsItemForLoad(data))
                return;
            const deviceId = asTrimmedString(data.current_device_id);
            if (!deviceId)
                return;
            loadCounts.set(deviceId, (loadCounts.get(deviceId) ?? 0) + 1);
        });
    }
    return loadCounts;
}
async function getPreferredOrderDeviceId(tenantRef, orderId, candidateDeviceIds, excludeItemId) {
    const snapshot = await tenantRef.collection("order_items").where("order_id", "==", orderId).get();
    for (const docSnap of snapshot.docs) {
        if (excludeItemId && docSnap.id === excludeItemId)
            continue;
        const data = (docSnap.data() ?? {});
        if (!isActiveKdsItemForLoad(data))
            continue;
        const currentDeviceId = asTrimmedString(data.current_device_id);
        if (currentDeviceId && candidateDeviceIds.has(currentDeviceId)) {
            return currentDeviceId;
        }
    }
    return null;
}
function sortStationsByOrder(stations) {
    return [...stations]
        .filter((station) => station.is_active !== false)
        .sort((left, right) => asNumber(left.sort_order) - asNumber(right.sort_order));
}
function getStationsAtFirstOrder(stations) {
    if (!stations.length)
        return [];
    const firstOrder = asNumber(stations[0].sort_order);
    return stations.filter((station) => asNumber(station.sort_order) === firstOrder);
}
function getEntryStationsForItem(stations, hasBorder) {
    const sortedStations = sortStationsByOrder(stations);
    const nonTerminalStations = sortedStations.filter((station) => asTrimmedString(station.station_type) !== "order_status");
    if (!nonTerminalStations.length)
        return [];
    if (hasBorder) {
        const borderStations = nonTerminalStations.filter((station) => asTrimmedString(station.station_type) === "item_assembly");
        return getStationsAtFirstOrder(borderStations.length ? borderStations : nonTerminalStations);
    }
    const nonBorderStations = nonTerminalStations.filter((station) => asTrimmedString(station.station_type) !== "item_assembly");
    const prepStartStations = nonBorderStations.filter((station) => asTrimmedString(station.station_type) === "prep_start");
    const preferredStations = prepStartStations.length ? prepStartStations : nonBorderStations;
    return getStationsAtFirstOrder(preferredStations.length ? preferredStations : nonTerminalStations);
}
function getNextStationsInFlow(stations, currentStationId, orderType) {
    const sortedStations = sortStationsByOrder(stations);
    const currentStation = sortedStations.find((station) => station.id === currentStationId);
    if (!currentStation)
        return [];
    const currentStationType = asTrimmedString(currentStation.station_type);
    const currentOrder = asNumber(currentStation.sort_order);
    let candidates = sortedStations.filter((station) => station.is_active !== false && asNumber(station.sort_order) > currentOrder);
    if (currentStationType === "order_status") {
        if (orderType !== "dine_in")
            return [];
        candidates = candidates.filter((station) => asTrimmedString(station.station_type) === "order_status");
    }
    if (!candidates.length)
        return [];
    const nextOrder = Math.min(...candidates.map((station) => asNumber(station.sort_order)));
    return candidates.filter((station) => asNumber(station.sort_order) === nextOrder);
}
function getNextStationInFlow(stations, currentStationId, orderType) {
    return getNextStationsInFlow(stations, currentStationId, orderType)[0] ?? null;
}
function toStationResponse(row) {
    return {
        id: row.id,
        ...row.data,
    };
}
async function listTenantDocsByFieldIn(tenantRef, collectionName, field, values) {
    const uniqueValues = [...new Set(values.filter(Boolean))];
    if (!uniqueValues.length)
        return [];
    const all = [];
    for (const chunk of chunkStrings(uniqueValues)) {
        const snapshot = await tenantRef.collection(collectionName).where(field, "in", chunk).get();
        all.push(...snapshot.docs.map((docSnap) => docRow(docSnap)));
    }
    return all;
}
async function getRootDocsByIds(collectionName, ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length)
        return [];
    const firestore = (0, firestore_1.getFirestore)();
    const snapshots = await Promise.all(uniqueIds.map((id) => firestore.collection(collectionName).doc(id).get()));
    return snapshots.filter((snap) => snap.exists).map((snap) => docRow(snap));
}
async function getTenantDocsByIds(tenantRef, collectionName, ids) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length)
        return [];
    const snapshots = await Promise.all(uniqueIds.map((id) => tenantRef.collection(collectionName).doc(id).get()));
    return snapshots.filter((snap) => snap.exists).map((snap) => docRow(snap));
}
async function getKdsSettingsDoc(tenantRef) {
    const snapshot = await tenantRef.collection("kds_global_settings").limit(1).get();
    if (snapshot.empty)
        return null;
    return docRow(snapshot.docs[0]);
}
async function listKdsStationsDocs(tenantRef) {
    const snapshot = await tenantRef.collection("kds_stations").orderBy("sort_order", "asc").get();
    return snapshot.docs
        .map((docSnap) => docRow(docSnap))
        .filter((row) => !asNullableString(row.data.deleted_at));
}
function getInternalDeviceStageId(deviceDocId) {
    return `device-stage-${deviceDocId}`;
}
async function ensureInternalStageForDeviceRow(tenantRef, row) {
    if (row.data.is_active === false)
        return row;
    const currentStationId = asNullableString(row.data.station_id);
    const currentStationSnap = currentStationId
        ? await tenantRef.collection("kds_stations").doc(currentStationId).get()
        : null;
    const currentStationData = currentStationSnap?.exists && !asNullableString(currentStationSnap.data()?.deleted_at)
        ? (currentStationSnap.data() ?? {})
        : null;
    const stageId = currentStationData ? currentStationId : getInternalDeviceStageId(row.id);
    const stageRef = tenantRef.collection("kds_stations").doc(stageId);
    const stageSnap = currentStationData ? currentStationSnap : await stageRef.get();
    const now = new Date().toISOString();
    const deviceStageType = normalizeDeviceStageType(row.data.stage_type ?? currentStationData?.station_type);
    const persistedDisplayOrder = asNullableNumber(row.data.display_order);
    const stageDisplayOrder = stageSnap.exists ? asNumber(stageSnap.data()?.sort_order, 1) : null;
    let deviceDisplayOrder = normalizeDeviceDisplayOrder(persistedDisplayOrder, stageDisplayOrder ?? 1);
    const isTerminal = row.data.is_terminal === true;
    const nextDeviceIds = isTerminal ? [] : normalizeDeviceNextIds(row.data.next_device_ids, row.data.next_device_id);
    if (!stageSnap.exists || asNullableString(stageSnap.data()?.deleted_at)) {
        const stationRows = await listKdsStationsDocs(tenantRef);
        const nextSortOrder = stationRows.reduce((highest, stationRow) => Math.max(highest, asNumber(stationRow.data.sort_order, 0)), 0) + 1;
        deviceDisplayOrder = persistedDisplayOrder ?? nextSortOrder;
        await stageRef.set({
            tenant_id: asTrimmedString(row.data.tenant_id),
            name: asTrimmedString(row.data.name) || "Etapa interna",
            station_type: deviceStageType,
            description: "Etapa interna automatica do dispositivo",
            color: DEFAULT_KDS_DEVICE_STAGE_COLOR,
            icon: DEFAULT_KDS_DEVICE_STAGE_ICON,
            sort_order: deviceDisplayOrder,
            is_active: true,
            deleted_at: null,
            created_at: now,
            updated_at: now,
        }, { merge: true });
    }
    else {
        await stageRef.set({
            name: asTrimmedString(row.data.name) || "Etapa interna",
            station_type: deviceStageType,
            sort_order: deviceDisplayOrder,
            updated_at: now,
        }, { merge: true });
    }
    await tenantRef.collection("kds_devices").doc(row.id).set({
        station_id: stageId,
        stage_type: deviceStageType,
        display_order: persistedDisplayOrder ?? deviceDisplayOrder,
        is_terminal: isTerminal,
        next_device_ids: nextDeviceIds,
        next_device_id: nextDeviceIds[0] ?? null,
        updated_at: now,
    }, { merge: true });
    return {
        ...row,
        data: {
            ...row.data,
            station_id: stageId,
            stage_type: deviceStageType,
            display_order: persistedDisplayOrder ?? deviceDisplayOrder,
            is_terminal: isTerminal,
            next_device_ids: nextDeviceIds,
            next_device_id: nextDeviceIds[0] ?? null,
        },
    };
}
async function listKdsDevicesDocs(tenantRef) {
    const snapshot = await tenantRef.collection("kds_devices").get();
    return snapshot.docs
        .map((docSnap) => docRow(docSnap))
        .filter((row) => !isDeletedKdsDeviceData(row.data))
        .sort((left, right) => {
        const leftOrder = normalizeDeviceDisplayOrder(left.data.display_order, Number.MAX_SAFE_INTEGER);
        const rightOrder = normalizeDeviceDisplayOrder(right.data.display_order, Number.MAX_SAFE_INTEGER);
        if (leftOrder !== rightOrder)
            return leftOrder - rightOrder;
        return asTrimmedString(left.data.name).localeCompare(asTrimmedString(right.data.name));
    });
}
async function countActiveItemsForStation(tenantRef, stationId) {
    const snapshot = await tenantRef.collection("order_items").where("current_station_id", "==", stationId).get();
    return snapshot.docs.reduce((total, docSnap) => {
        const row = (docSnap.data() ?? {});
        const stationStatus = asTrimmedString(row.station_status);
        if (asNullableString(row.cancelled_at) || asNullableString(row.served_at))
            return total;
        if (stationStatus !== "waiting" && stationStatus !== "in_progress")
            return total;
        return total + 1;
    }, 0);
}
async function findKdsDeviceAcrossTenants(firestore, field, value, excludePath) {
    const tenantsSnapshot = await firestore.collection("tenants").get();
    for (const tenantSnap of tenantsSnapshot.docs) {
        const snapshot = await tenantSnap.ref.collection("kds_devices").where(field, "==", value).limit(2).get();
        const match = snapshot.docs.find((docSnap) => {
            if (docSnap.ref.path === excludePath)
                return false;
            return !isDeletedKdsDeviceData((docSnap.data() ?? {}));
        });
        if (match) {
            return match;
        }
    }
    return null;
}
async function getKdsDeviceByCodes(firestore, verificationCode) {
    return await findKdsDeviceAcrossTenants(firestore, "verification_code", verificationCode);
}
async function getKdsDeviceByPublicId(tenantRef, deviceId) {
    const snapshot = await tenantRef.collection("kds_devices").where("device_id", "==", deviceId).limit(1).get();
    if (snapshot.empty)
        return null;
    const match = snapshot.docs.find((docSnap) => !isDeletedKdsDeviceData((docSnap.data() ?? {})));
    return match ?? null;
}
async function generateUniqueKdsCode(firestore, field, excludePath) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = `${Math.floor(100000 + Math.random() * 900000)}`;
        const existing = await findKdsDeviceAcrossTenants(firestore, field, candidate, excludePath);
        if (!existing) {
            return candidate;
        }
    }
    throw new Error("Nao foi possivel gerar codigo unico. Tente novamente.");
}
async function ensureKdsDeviceCodes(firestore, deviceSnap) {
    const data = (deviceSnap.data() ?? {});
    const existingVerificationCode = asTrimmedString(data.verification_code);
    const existingAuthCode = asTrimmedString(data.auth_code);
    if (existingVerificationCode && existingAuthCode) {
        return {
            verification_code: existingVerificationCode,
            auth_code: existingAuthCode,
        };
    }
    const verification_code = await generateUniqueKdsCode(firestore, "verification_code", deviceSnap.ref.path);
    const auth_code = await generateUniqueKdsCode(firestore, "auth_code", deviceSnap.ref.path);
    await deviceSnap.ref.set({ verification_code, auth_code }, { merge: true });
    return { verification_code, auth_code };
}
async function requireKdsDeviceAccess(req, res, tenantId, deviceId) {
    const firestore = (0, firestore_1.getFirestore)();
    const tenantRef = firestore.collection("tenants").doc(tenantId);
    const deviceSnap = await getKdsDeviceByPublicId(tenantRef, deviceId);
    if (!deviceSnap) {
        json(res, 403, { error: "Dispositivo nao encontrado ou nao pertence ao tenant" });
        return null;
    }
    const now = new Date().toISOString();
    await deviceSnap.ref.set({ last_seen_at: now, is_active: true }, { merge: true });
    const refreshedDeviceSnap = await deviceSnap.ref.get();
    return { firestore, tenantRef, deviceSnap: refreshedDeviceSnap, now };
}
async function buildKdsOrders(tenantRef, statuses, options) {
    const normalizedStatuses = (statuses ?? []).map((status) => status.trim()).filter(Boolean);
    let ordersRaw = [];
    let itemsRaw = [];
    if (options?.deviceId) {
        const [activeItemsSnapshot, cancelledItemsSnapshot] = await Promise.all([
            tenantRef.collection("order_items").where("current_device_id", "==", options.deviceId).get(),
            tenantRef.collection("order_items").where("cancelled_device_id", "==", options.deviceId).get(),
        ]);
        const itemById = new Map();
        [...activeItemsSnapshot.docs, ...cancelledItemsSnapshot.docs].forEach((docSnap) => {
            itemById.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
        itemsRaw = sortByIsoAsc([...itemById.values()]);
        if (!itemsRaw.length)
            return [];
        const orderRows = await getTenantDocsByIds(tenantRef, "orders", itemsRaw.map((item) => asTrimmedString(item.order_id)).filter(Boolean));
        ordersRaw = sortByIsoDesc(orderRows
            .map((row) => ({ id: row.id, ...row.data }))
            .filter((order) => !normalizedStatuses.length || normalizedStatuses.includes(asTrimmedString(order.status))));
        if (!ordersRaw.length)
            return [];
        const allowedOrderIds = new Set(ordersRaw.map((order) => order.id));
        itemsRaw = itemsRaw.filter((item) => allowedOrderIds.has(asTrimmedString(item.order_id)));
        if (!itemsRaw.length)
            return [];
    }
    else {
        const ordersSnapshot = await tenantRef.collection("orders").orderBy("created_at", "desc").limit(250).get();
        ordersRaw = sortByIsoDesc(ordersSnapshot.docs
            .map((snap) => ({ id: snap.id, ...snap.data() }))
            .filter((order) => !normalizedStatuses.length || normalizedStatuses.includes(asTrimmedString(order.status))));
        if (!ordersRaw.length)
            return [];
        const orderIds = ordersRaw.map((order) => order.id);
        const itemRows = await listTenantDocsByFieldIn(tenantRef, "order_items", "order_id", orderIds);
        itemsRaw = sortByIsoAsc(itemRows.map((row) => ({ id: row.id, ...row.data })));
    }
    const [extrasRows, subItemRows, tablesRows, productsRows, variationsRows, profilesRows, stationRows, settingsRow, deviceRows] = await Promise.all([
        listTenantDocsByFieldIn(tenantRef, "order_item_extras", "order_item_id", itemsRaw.map((item) => item.id)),
        listTenantDocsByFieldIn(tenantRef, "order_item_sub_items", "order_item_id", itemsRaw.map((item) => item.id)),
        getTenantDocsByIds(tenantRef, "tables", ordersRaw.map((order) => asTrimmedString(order.table_id)).filter(Boolean)),
        getTenantDocsByIds(tenantRef, "products", itemsRaw.map((item) => asTrimmedString(item.product_id)).filter(Boolean)),
        getTenantDocsByIds(tenantRef, "product_variations", itemsRaw.map((item) => asTrimmedString(item.variation_id)).filter(Boolean)),
        getRootDocsByIds("profiles", [
            ...ordersRaw.map((order) => asTrimmedString(order.created_by)).filter(Boolean),
            ...itemsRaw.map((item) => asTrimmedString(item.added_by)).filter(Boolean),
        ]),
        listKdsStationsDocs(tenantRef),
        getKdsSettingsDoc(tenantRef),
        listKdsDevicesDocs(tenantRef),
    ]);
    const subExtraRows = await listTenantDocsByFieldIn(tenantRef, "order_item_sub_item_extras", "sub_item_id", subItemRows.map((subItem) => subItem.id));
    const tableMap = new Map(tablesRows.map((row) => [row.id, row.data]));
    const productMap = new Map(productsRows.map((row) => [row.id, row.data]));
    const variationMap = new Map(variationsRows.map((row) => [row.id, row.data]));
    const profileMap = new Map(profilesRows.map((row) => [row.id, row.data]));
    const stationMap = new Map(stationRows.map((row) => [row.id, row.data]));
    const orderStatusById = new Map(ordersRaw.map((order) => [order.id, asTrimmedString(order.status)]));
    const orderTypeById = new Map(ordersRaw.map((order) => [order.id, asTrimmedString(order.order_type)]));
    const activeStations = sortStationsByOrder(stationRows
        .map((row) => ({ id: row.id, ...row.data }))
        .filter((station) => station.is_active !== false));
    const routableDevices = deviceRows
        .map((row) => resolveKdsDeviceRow(row, stationMap))
        .filter((device) => device.is_active && !!device.device_id && !!device.station_id);
    const resolvedDeviceByPublicId = new Map(routableDevices.map((device) => [device.device_id, device]));
    const onlineDevices = routableDevices.filter(isResolvedDeviceOnline);
    const allDevicesByStation = new Map();
    const onlineDevicesByStation = new Map();
    const deviceByPublicId = new Map();
    routableDevices.forEach((device) => {
        if (!device.station_id)
            return;
        const current = allDevicesByStation.get(device.station_id) ?? [];
        current.push(device);
        allDevicesByStation.set(device.station_id, current);
        deviceByPublicId.set(device.device_id, device);
    });
    onlineDevices.forEach((device) => {
        if (!device.station_id)
            return;
        const current = onlineDevicesByStation.get(device.station_id) ?? [];
        current.push(device);
        onlineDevicesByStation.set(device.station_id, current);
    });
    const extrasByItemId = new Map();
    extrasRows.forEach((extra) => {
        const orderItemId = asTrimmedString(extra.data.order_item_id);
        const current = extrasByItemId.get(orderItemId) ?? [];
        current.push({
            extra_name: asTrimmedString(extra.data.extra_name),
            price: asNumber(extra.data.price),
            kds_category: asNullableString(extra.data.kds_category) ?? undefined,
        });
        extrasByItemId.set(orderItemId, current);
    });
    const subExtrasBySubItemId = new Map();
    subExtraRows.forEach((subExtra) => {
        const subItemId = asTrimmedString(subExtra.data.sub_item_id);
        const current = subExtrasBySubItemId.get(subItemId) ?? [];
        current.push({
            id: subExtra.id,
            group_name: asTrimmedString(subExtra.data.group_name),
            option_name: asTrimmedString(subExtra.data.option_name),
            price: asNumber(subExtra.data.price),
            quantity: asNumber(subExtra.data.quantity),
            kds_category: asNullableString(subExtra.data.kds_category) ?? undefined,
        });
        subExtrasBySubItemId.set(subItemId, current);
    });
    const subItemsByItemId = new Map();
    const subItemIdsByItemId = new Map();
    const subItemsRaw = sortByIsoAsc(subItemRows.map((row) => ({ id: row.id, ...row.data })));
    subItemsRaw.forEach((subItem) => {
        const orderItemId = asTrimmedString(subItem.order_item_id);
        const current = subItemsByItemId.get(orderItemId) ?? [];
        current.push({
            id: subItem.id,
            sub_item_index: asNumber(subItem.sub_item_index),
            notes: asNullableString(subItem.notes),
            sub_extras: subExtrasBySubItemId.get(subItem.id) ?? [],
        });
        subItemsByItemId.set(orderItemId, current);
        subItemIdsByItemId.set(orderItemId, [...(subItemIdsByItemId.get(orderItemId) ?? []), subItem.id]);
    });
    const deviceCardLoadCounts = new Map();
    allDevicesByStation.forEach((devices) => {
        devices.forEach((device) => {
            deviceCardLoadCounts.set(asTrimmedString(device.device_id), 0);
        });
    });
    itemsRaw.forEach((item) => {
        const stationId = asNullableString(item.current_station_id);
        const stationStatus = asTrimmedString(item.station_status);
        const deviceId = asNullableString(item.current_device_id);
        if (!stationId || !deviceId)
            return;
        if (asNullableString(item.cancelled_at) || asNullableString(item.served_at))
            return;
        if (stationStatus !== "waiting" && stationStatus !== "in_progress")
            return;
        if (!deviceCardLoadCounts.has(deviceId))
            return;
        deviceCardLoadCounts.set(deviceId, (deviceCardLoadCounts.get(deviceId) ?? 0) + 1);
    });
    const itemRoutingTextByItemId = new Map();
    itemsRaw.forEach((item) => {
        const itemExtras = extrasByItemId.get(item.id) ?? [];
        const itemSubExtras = (subItemIdsByItemId.get(item.id) ?? [])
            .flatMap((subItemId) => subExtrasBySubItemId.get(subItemId) ?? []);
        itemRoutingTextByItemId.set(item.id, buildItemRoutingText({
            notes: item.notes,
            extras: itemExtras,
            subExtras: itemSubExtras,
        }));
    });
    const entryDeviceAssignmentByOrderGroup = new Map();
    const pickAssignmentForCandidateStations = (candidateStations, preferredDeviceId) => {
        const candidateDevices = getCandidateDevicesForStations(candidateStations, allDevicesByStation, onlineDevicesByStation);
        if (!candidateDevices.length)
            return null;
        const selectedDeviceId = pickLeastLoadedDeviceId(candidateDevices, deviceCardLoadCounts, preferredDeviceId);
        const selectedDevice = selectedDeviceId ? deviceByPublicId.get(selectedDeviceId) ?? null : null;
        if (!selectedDevice?.station_id)
            return null;
        deviceCardLoadCounts.set(selectedDevice.device_id, (deviceCardLoadCounts.get(selectedDevice.device_id) ?? 0) + 1);
        return {
            stationId: selectedDevice.station_id,
            deviceId: selectedDevice.device_id,
        };
    };
    const getInitialAssignmentForItem = (item, orderId, orderStatus) => {
        if (orderStatus === "ready" || orderStatus === "delivered" || orderStatus === "cancelled")
            return null;
        if (asNullableString(item.cancelled_at) || asNullableString(item.served_at))
            return null;
        if (asTrimmedString(item.status) === "delivered" || asTrimmedString(item.status) === "cancelled")
            return null;
        if (asTrimmedString(item.station_status) === "completed" || asTrimmedString(item.station_status) === "done")
            return null;
        const itemRoutingText = itemRoutingTextByItemId.get(item.id) ?? "";
        const candidateEntryStations = getEntryStationsForItem(activeStations, itemRoutingText.includes("border") || itemRoutingText.includes("borda"));
        const candidateEntryDevices = getCandidateDevicesForStations(candidateEntryStations, allDevicesByStation, onlineDevicesByStation);
        if (!candidateEntryDevices.length)
            return null;
        const entryGroupKey = `${orderId}::${candidateEntryDevices.map((device) => device.device_id).sort().join("|")}`;
        const existingEntryDeviceId = entryDeviceAssignmentByOrderGroup.get(entryGroupKey);
        const preferredDeviceId = existingEntryDeviceId && candidateEntryDevices.some((device) => device.device_id === existingEntryDeviceId)
            ? existingEntryDeviceId
            : null;
        const selectedAssignment = pickAssignmentForCandidateStations(candidateEntryStations, preferredDeviceId);
        if (selectedAssignment) {
            entryDeviceAssignmentByOrderGroup.set(entryGroupKey, selectedAssignment.deviceId);
        }
        return selectedAssignment;
    };
    const canAssignItemToKds = (item, status) => {
        if (asNullableString(item.cancelled_at) || asNullableString(item.served_at))
            return false;
        if (status === "cancelled" || status === "delivered")
            return false;
        const stationStatus = asTrimmedString(item.station_status);
        if (stationStatus === "completed" || stationStatus === "done")
            return false;
        return true;
    };
    const resolvedItems = itemsRaw.map((item) => {
        const orderId = asTrimmedString(item.order_id);
        const orderStatus = orderStatusById.get(orderId) || "pending";
        const originalDeviceId = asNullableString(item.current_device_id);
        const originalDevice = originalDeviceId ? deviceByPublicId.get(originalDeviceId) ?? null : null;
        const originalStationId = originalDevice?.station_id ?? asNullableString(item.current_station_id);
        const normalizedItemStatus = asNullableString(item.cancelled_at)
            ? "cancelled"
            : asNullableString(item.served_at)
                ? "delivered"
                : asTrimmedString(item.status) || "pending";
        const originalStation = originalStationId ? stationMap.get(originalStationId) : null;
        const stationStatus = asNullableString(item.station_status) ?? (originalStationId ? "waiting" : null);
        const shouldReassignWithinCurrentStation = !!originalStation &&
            stationStatus === "waiting" &&
            normalizedItemStatus !== "cancelled" &&
            normalizedItemStatus !== "delivered" &&
            (!originalDevice || !isResolvedDeviceOnline(originalDevice));
        const reboundAssignment = shouldReassignWithinCurrentStation
            ? pickAssignmentForCandidateStations(activeStations.filter((station) => station.id === originalStationId), originalDeviceId)
            : null;
        const initialAssignment = !originalStationId
            ? getInitialAssignmentForItem(item, orderId, orderStatus)
            : null;
        const resolvedDeviceId = reboundAssignment?.deviceId ??
            originalDevice?.device_id ??
            initialAssignment?.deviceId ??
            null;
        const resolvedStationId = reboundAssignment?.stationId ??
            (resolvedDeviceId ? deviceByPublicId.get(resolvedDeviceId)?.station_id ?? null : null) ??
            originalStationId ??
            initialAssignment?.stationId ??
            null;
        return {
            ...item,
            order_id: orderId,
            normalized_item_status: normalizedItemStatus,
            resolved_station_id: resolvedStationId,
            resolved_station_status: stationStatus ?? (resolvedStationId ? "waiting" : null),
            resolved_device_id: resolvedDeviceId,
            preferred_device_id: originalDeviceId,
            can_assign_to_device: !!resolvedDeviceId && canAssignItemToKds(item, normalizedItemStatus),
        };
    });
    const assignmentRepairBatch = tenantRef.firestore.batch();
    let assignmentRepairCount = 0;
    const assignmentRepairNow = new Date().toISOString();
    resolvedItems.forEach((item) => {
        const originalDeviceId = asNullableString(item.current_device_id);
        const originalStationId = asNullableString(item.current_station_id);
        const originalStationStatus = asNullableString(item.station_status);
        const resolvedDeviceId = item.resolved_device_id;
        const resolvedStationId = item.resolved_station_id;
        if (!item.can_assign_to_device || !resolvedDeviceId || !resolvedStationId) {
            return;
        }
        const shouldRepairAssignment = !originalDeviceId ||
            !originalStationId ||
            originalDeviceId !== resolvedDeviceId ||
            originalStationId !== resolvedStationId ||
            !originalStationStatus;
        if (!shouldRepairAssignment) {
            return;
        }
        assignmentRepairBatch.set(tenantRef.collection("order_items").doc(item.id), {
            current_station_id: resolvedStationId,
            current_device_id: resolvedDeviceId,
            station_status: "waiting",
            station_started_at: null,
            station_completed_at: null,
            claimed_by_device_id: null,
            claimed_at: null,
            updated_at: assignmentRepairNow,
        }, { merge: true });
        assignmentRepairCount += 1;
    });
    if (assignmentRepairCount > 0) {
        await assignmentRepairBatch.commit();
    }
    const itemsByOrderId = new Map();
    resolvedItems.forEach((item) => {
        const orderId = item.order_id;
        const resolvedStationId = item.resolved_station_id;
        const resolvedDeviceId = item.resolved_device_id;
        const product = productMap.get(asTrimmedString(item.product_id));
        const variation = variationMap.get(asTrimmedString(item.variation_id));
        const station = resolvedStationId ? stationMap.get(resolvedStationId) : null;
        const currentDevice = resolvedDeviceId ? resolvedDeviceByPublicId.get(resolvedDeviceId) ?? null : null;
        const nextStations = resolvedStationId
            ? getNextStationsInFlow(activeStations, resolvedStationId, orderTypeById.get(orderId))
            : [];
        const nextStation = nextStations[0] ?? null;
        const nextStationNames = nextStations
            .map((candidateStation) => asTrimmedString(candidateStation.name))
            .filter(Boolean);
        const addedByProfile = profileMap.get(asTrimmedString(item.added_by));
        const current = itemsByOrderId.get(orderId) ?? [];
        current.push({
            id: item.id,
            order_id: orderId,
            product_id: asNullableString(item.product_id),
            variation_id: asNullableString(item.variation_id),
            quantity: asNumber(item.quantity),
            unit_price: asNumber(item.unit_price),
            total_price: asNumber(item.total_price),
            notes: asNullableString(item.notes),
            status: item.normalized_item_status,
            created_at: asTrimmedString(item.created_at),
            added_by: asNullableString(item.added_by),
            current_station_id: resolvedStationId,
            current_device_id: resolvedDeviceId,
            station_status: item.resolved_station_status,
            station_started_at: asNullableString(item.station_started_at),
            station_completed_at: asNullableString(item.station_completed_at),
            served_at: asNullableString(item.served_at),
            cancelled_at: asNullableString(item.cancelled_at),
            cancelled_by: asNullableString(item.cancelled_by),
            cancellation_reason: asNullableString(item.cancellation_reason),
            cancelled_station_id: asNullableString(item.cancelled_station_id),
            cancelled_device_id: asNullableString(item.cancelled_device_id),
            cancelled_station_status: asNullableString(item.cancelled_station_status),
            claimed_by_device_id: asNullableString(item.claimed_by_device_id),
            claimed_at: asNullableString(item.claimed_at),
            current_device_name: currentDevice?.name ?? null,
            next_device_name: nextStationNames.length > 1 ? `Balanceado: ${nextStationNames.join(", ")}` : nextStation?.name ?? null,
            next_device_station_type: nextStation ? asTrimmedString(nextStation.station_type) : null,
            product: product
                ? {
                    name: asTrimmedString(product.name),
                    image_url: asNullableString(product.image_url),
                }
                : undefined,
            variation: variation ? { name: asTrimmedString(variation.name) } : null,
            extras: extrasByItemId.get(item.id) ?? [],
            current_station: station
                ? {
                    id: resolvedStationId,
                    name: asTrimmedString(station.name),
                    station_type: asTrimmedString(station.station_type),
                    color: asNullableString(station.color),
                    icon: asNullableString(station.icon),
                    sort_order: asNullableNumber(station.sort_order),
                }
                : null,
            added_by_profile: addedByProfile ? { name: asTrimmedString(addedByProfile.name) } : null,
            sub_items: subItemsByItemId.get(item.id) ?? [],
        });
        itemsByOrderId.set(orderId, current);
    });
    return ordersRaw.map((order) => {
        const table = tableMap.get(asTrimmedString(order.table_id));
        const createdByProfile = profileMap.get(asTrimmedString(order.created_by));
        const orderItems = (itemsByOrderId.get(order.id) ?? []).filter((item) => {
            if (!options?.deviceId)
                return true;
            const itemStatus = asTrimmedString(item.status);
            const activeDeviceId = asNullableString(item.current_device_id);
            const cancelledDeviceId = asNullableString(item.cancelled_device_id);
            if (itemStatus === "cancelled" || asNullableString(item.cancelled_at)) {
                return cancelledDeviceId === options.deviceId;
            }
            return activeDeviceId === options.deviceId;
        });
        if (!orderItems.length) {
            return null;
        }
        return {
            id: order.id,
            table_id: asNullableString(order.table_id),
            order_type: asTrimmedString(order.order_type) || "dine_in",
            status: asTrimmedString(order.status) || "pending",
            customer_name: asNullableString(order.customer_name),
            customer_phone: asNullableString(order.customer_phone),
            customer_address: asNullableString(order.customer_address),
            subtotal: asNumber(order.subtotal),
            discount: asNumber(order.discount),
            total: asNumber(order.total),
            notes: asNullableString(order.notes),
            party_size: asNullableNumber(order.party_size),
            created_by: asNullableString(order.created_by),
            created_at: asTrimmedString(order.created_at),
            updated_at: asTrimmedString(order.updated_at) || asTrimmedString(order.created_at),
            ready_at: asNullableString(order.ready_at),
            served_at: asNullableString(order.served_at),
            delivered_at: asNullableString(order.delivered_at),
            cancelled_at: asNullableString(order.cancelled_at),
            cancelled_by: asNullableString(order.cancelled_by),
            cancellation_reason: asNullableString(order.cancellation_reason),
            status_before_cancellation: asNullableString(order.status_before_cancellation),
            is_draft: Boolean(order.is_draft),
            table: table ? { number: asNumber(table.number) } : null,
            order_items: orderItems,
            created_by_profile: createdByProfile ? { name: asTrimmedString(createdByProfile.name) } : null,
        };
    }).filter(Boolean);
}
async function createKdsStationLogEntry(tenantRef, tenantId, payload) {
    await tenantRef.collection("kds_station_logs").add({
        ...payload,
        performed_by: payload.performed_by ?? null,
        duration_seconds: payload.duration_seconds ?? null,
        notes: payload.notes ?? null,
        created_at: new Date().toISOString(),
        tenant_id: tenantId,
    });
}
exports.kdsDeviceAuth = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const action = asTrimmedString(req.body?.action);
    try {
        const firestore = (0, firestore_1.getFirestore)();
        if (action === "login_by_codes") {
            const verificationCode = asTrimmedString(req.body?.verification_code);
            const authCode = asTrimmedString(req.body?.auth_code);
            if (!verificationCode || !authCode) {
                json(res, 400, { error: "verification_code e auth_code sao obrigatorios" });
                return;
            }
            const deviceSnap = await getKdsDeviceByCodes(firestore, verificationCode);
            if (!deviceSnap) {
                json(res, 401, { error: "Codigo verificador invalido" });
                return;
            }
            const deviceData = (deviceSnap.data() ?? {});
            if (isDeletedKdsDeviceData(deviceData)) {
                json(res, 401, { error: "Codigo verificador invalido" });
                return;
            }
            if (asTrimmedString(deviceData.auth_code) !== authCode) {
                json(res, 401, { error: "Codigo de autenticacao invalido" });
                return;
            }
            const tenantId = getTenantIdFromSubcollectionDoc(deviceSnap);
            const now = new Date().toISOString();
            await deviceSnap.ref.set({ last_seen_at: now, is_active: true }, { merge: true });
            json(res, 200, {
                success: true,
                device: sanitizeKdsDevice(deviceSnap.id, tenantId, {
                    ...deviceData,
                    last_seen_at: now,
                    is_active: true,
                }),
            });
            return;
        }
        const tenantId = asTrimmedString(req.body?.tenant_id);
        if (!tenantId) {
            json(res, 400, { error: "tenant_id e obrigatorio" });
            return;
        }
        const access = await requireTenantAccess(req, res, tenantId);
        if (!access)
            return;
        if (action === "register") {
            const name = asTrimmedString(req.body?.name);
            if (!name) {
                json(res, 400, { error: "name e obrigatorio" });
                return;
            }
            const verification_code = await generateUniqueKdsCode(firestore, "verification_code");
            const auth_code = await generateUniqueKdsCode(firestore, "auth_code");
            const now = new Date().toISOString();
            const stationRows = await listKdsStationsDocs(access.tenantRef);
            const nextSortOrder = stationRows.reduce((highest, row) => {
                return Math.max(highest, asNumber(row.data.sort_order, 0));
            }, 0) + 1;
            const stationRef = access.tenantRef.collection("kds_stations").doc();
            const stationPayload = {
                tenant_id: tenantId,
                name,
                station_type: "custom",
                description: null,
                color: "#3B82F6",
                icon: "ChefHat",
                sort_order: nextSortOrder,
                is_active: true,
                created_at: now,
                updated_at: now,
            };
            const deviceRef = access.tenantRef.collection("kds_devices").doc();
            const devicePayload = {
                device_id: crypto.randomUUID(),
                name,
                station_id: stationRef.id,
                stage_type: "custom",
                display_order: nextSortOrder,
                is_terminal: false,
                operation_mode: "production_line",
                routing_mode: "default",
                routing_keywords: [],
                is_entry_device: false,
                next_device_ids: [],
                next_device_id: null,
                verification_code,
                auth_code,
                last_seen_at: now,
                is_active: true,
                deleted_at: null,
                created_at: now,
                updated_at: now,
                tenant_id: tenantId,
            };
            await Promise.all([
                stationRef.set(stationPayload),
                deviceRef.set(devicePayload),
            ]);
            json(res, 201, {
                success: true,
                device: sanitizeKdsDevice(deviceRef.id, tenantId, devicePayload),
                verification_code,
                auth_code,
            });
            return;
        }
        if (action === "regenerate_codes" || action === "get_codes") {
            const deviceDocId = asTrimmedString(req.body?.device_id);
            if (!deviceDocId) {
                json(res, 400, { error: "device_id e obrigatorio" });
                return;
            }
            const deviceSnap = await access.tenantRef.collection("kds_devices").doc(deviceDocId).get();
            if (!deviceSnap.exists) {
                json(res, 404, { error: "Dispositivo nao encontrado" });
                return;
            }
            if (isDeletedKdsDeviceData((deviceSnap.data() ?? {}))) {
                json(res, 404, { error: "Dispositivo nao encontrado" });
                return;
            }
            if (action === "regenerate_codes") {
                const verification_code = await generateUniqueKdsCode(firestore, "verification_code", deviceSnap.ref.path);
                const auth_code = await generateUniqueKdsCode(firestore, "auth_code", deviceSnap.ref.path);
                await deviceSnap.ref.set({ verification_code, auth_code }, { merge: true });
                json(res, 200, { success: true, verification_code, auth_code });
                return;
            }
            const codes = await ensureKdsDeviceCodes(firestore, deviceSnap);
            json(res, 200, { success: true, ...codes });
            return;
        }
        json(res, 400, { error: "Acao invalida" });
    }
    catch (error) {
        logger.error("kdsDeviceAuth failed", { error, body: req.body });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.kdsData = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const action = asTrimmedString(req.body?.action);
    const tenantId = asTrimmedString(req.body?.tenant_id);
    const deviceId = asTrimmedString(req.body?.device_id);
    const stationAdminActions = new Set([
        "list_stations",
        "create_station",
        "update_station",
        "delete_station",
        "toggle_station_active",
        "reorder_stations",
        "list_devices",
        "set_device_station",
    ]);
    try {
        if (stationAdminActions.has(action)) {
            if (!tenantId) {
                json(res, 400, { error: "tenant_id e obrigatorio" });
                return;
            }
            const access = await requireTenantAccess(req, res, tenantId);
            if (!access)
                return;
            if (action === "list_stations") {
                const stations = await listKdsStationsDocs(access.tenantRef);
                json(res, 200, {
                    stations: stations.map(toStationResponse),
                });
                return;
            }
            if (action === "list_devices") {
                const devices = await listKdsDevicesDocs(access.tenantRef);
                json(res, 200, {
                    devices: devices.map((device) => sanitizeKdsDevice(device.id, tenantId, device.data)),
                });
                return;
            }
            if (action === "create_station") {
                const name = asTrimmedString(req.body?.name);
                if (!name) {
                    json(res, 400, { error: "name e obrigatorio" });
                    return;
                }
                const stations = await listKdsStationsDocs(access.tenantRef);
                const maxSortOrder = stations.reduce((current, station) => {
                    return Math.max(current, asNumber(station.data.sort_order, -1));
                }, -1);
                const now = new Date().toISOString();
                const stationRef = access.tenantRef.collection("kds_stations").doc();
                const stationPayload = {
                    tenant_id: tenantId,
                    name,
                    station_type: normalizeStationType(req.body?.station_type),
                    description: asNullableString(req.body?.description),
                    color: normalizeStationColor(req.body?.color),
                    icon: normalizeStationIcon(req.body?.icon),
                    sort_order: asNullableNumber(req.body?.sort_order) ?? maxSortOrder + 1,
                    is_active: req.body?.is_active !== false,
                    created_at: now,
                    updated_at: now,
                };
                await stationRef.set(stationPayload);
                json(res, 201, { station: { id: stationRef.id, ...stationPayload } });
                return;
            }
            if (action === "update_station") {
                const stationId = asTrimmedString(req.body?.station_id);
                if (!stationId) {
                    json(res, 400, { error: "station_id e obrigatorio" });
                    return;
                }
                const stationRef = access.tenantRef.collection("kds_stations").doc(stationId);
                const stationSnap = await stationRef.get();
                if (!stationSnap.exists) {
                    json(res, 404, { error: "Praca nao encontrada" });
                    return;
                }
                const updates = {
                    updated_at: new Date().toISOString(),
                };
                if (req.body?.name !== undefined) {
                    const name = asTrimmedString(req.body?.name);
                    if (!name) {
                        json(res, 400, { error: "name nao pode ser vazio" });
                        return;
                    }
                    updates.name = name;
                }
                if (req.body?.station_type !== undefined) {
                    updates.station_type = normalizeStationType(req.body?.station_type);
                }
                if (req.body?.description !== undefined) {
                    updates.description = asNullableString(req.body?.description);
                }
                if (req.body?.color !== undefined) {
                    updates.color = normalizeStationColor(req.body?.color);
                }
                if (req.body?.icon !== undefined) {
                    updates.icon = normalizeStationIcon(req.body?.icon);
                }
                if (req.body?.sort_order !== undefined) {
                    updates.sort_order = asNumber(req.body?.sort_order);
                }
                if (req.body?.is_active !== undefined) {
                    updates.is_active = Boolean(req.body?.is_active);
                }
                await stationRef.set(updates, { merge: true });
                const updatedSnap = await stationRef.get();
                json(res, 200, { station: toStationResponse(docRow(updatedSnap)) });
                return;
            }
            if (action === "set_device_station") {
                const deviceDocId = asTrimmedString(req.body?.device_id);
                const stationId = req.body?.station_id === null ? null : asNullableString(req.body?.station_id);
                if (!deviceDocId) {
                    json(res, 400, { error: "device_id e obrigatorio" });
                    return;
                }
                const deviceRef = access.tenantRef.collection("kds_devices").doc(deviceDocId);
                const deviceSnap = await deviceRef.get();
                if (!deviceSnap.exists || isDeletedKdsDeviceData((deviceSnap.data() ?? {}))) {
                    json(res, 404, { error: "Dispositivo nao encontrado" });
                    return;
                }
                if (stationId) {
                    const stationSnap = await access.tenantRef.collection("kds_stations").doc(stationId).get();
                    if (!stationSnap.exists) {
                        json(res, 404, { error: "Praca nao encontrada" });
                        return;
                    }
                    const stationData = (stationSnap.data() ?? {});
                    if (asNullableString(stationData.deleted_at) || stationData.is_active === false) {
                        json(res, 409, { error: "A praca selecionada nao esta ativa" });
                        return;
                    }
                }
                await deviceRef.set({
                    station_id: stationId,
                    updated_at: new Date().toISOString(),
                }, { merge: true });
                const updatedSnap = await deviceRef.get();
                json(res, 200, {
                    success: true,
                    device: sanitizeKdsDevice(updatedSnap.id, tenantId, (updatedSnap.data() ?? {})),
                });
                return;
            }
            if (action === "delete_station") {
                const stationId = asTrimmedString(req.body?.station_id);
                if (!stationId) {
                    json(res, 400, { error: "station_id e obrigatorio" });
                    return;
                }
                const stationRef = access.tenantRef.collection("kds_stations").doc(stationId);
                const stationSnap = await stationRef.get();
                if (!stationSnap.exists) {
                    json(res, 404, { error: "Praca nao encontrada" });
                    return;
                }
                const [assignedDevicesSnap, activeItemsSnap, stationRows, deviceRows] = await Promise.all([
                    access.tenantRef
                        .collection("kds_devices")
                        .where("station_id", "==", stationId)
                        .get(),
                    access.tenantRef
                        .collection("order_items")
                        .where("current_station_id", "==", stationId)
                        .get(),
                    listKdsStationsDocs(access.tenantRef),
                    listKdsDevicesDocs(access.tenantRef),
                ]);
                const stationData = (stationSnap.data() ?? {});
                const activeItemDocs = activeItemsSnap.docs.filter((docSnap) => {
                    const row = (docSnap.data() ?? {});
                    const stationStatus = asTrimmedString(row.station_status);
                    if (asNullableString(row.cancelled_at) || asNullableString(row.served_at))
                        return false;
                    return stationStatus === "waiting" || stationStatus === "in_progress";
                });
                const remainingStations = stationRows
                    .map((row) => ({ id: row.id, ...row.data }))
                    .filter((row) => row.id !== stationId && row.is_active !== false);
                const deletingOrderStatus = normalizeStationType(stationData.station_type) === "order_status";
                const compatibleStations = remainingStations
                    .filter((row) => {
                    const rowType = normalizeStationType(row.station_type);
                    if (deletingOrderStatus)
                        return rowType === "order_status";
                    return rowType !== "order_status";
                })
                    .sort((left, right) => asNumber(left.sort_order) - asNumber(right.sort_order));
                const fallbackStations = compatibleStations.length > 0 ? compatibleStations : remainingStations;
                const activeDevicesByStation = new Map();
                deviceRows
                    .map((row) => ({ id: row.id, ...row.data }))
                    .filter((device) => {
                    if (device.is_active === false)
                        return false;
                    const deviceStationId = asTrimmedString(device.station_id);
                    if (!deviceStationId || deviceStationId === stationId)
                        return false;
                    return isRecentIso(asNullableString(device.last_seen_at), KDS_DEVICE_ONLINE_WINDOW_MS);
                })
                    .forEach((device) => {
                    const deviceStationId = asTrimmedString(device.station_id);
                    const current = activeDevicesByStation.get(deviceStationId) ?? [];
                    current.push(device);
                    activeDevicesByStation.set(deviceStationId, current);
                });
                const stationLoadCounts = new Map();
                for (const station of fallbackStations) {
                    stationLoadCounts.set(station.id, await countActiveItemsForStation(access.tenantRef, station.id));
                }
                const deviceLoadCounts = new Map();
                activeDevicesByStation.forEach((devices) => {
                    devices.forEach((device) => {
                        deviceLoadCounts.set(asTrimmedString(device.device_id), 0);
                    });
                });
                remainingStations.forEach((station) => {
                    const stationDevices = activeDevicesByStation.get(station.id) ?? [];
                    stationDevices.forEach((device) => {
                        const deviceId = asTrimmedString(device.device_id);
                        deviceLoadCounts.set(deviceId, deviceLoadCounts.get(deviceId) ?? 0);
                    });
                });
                const pickReplacementStation = () => {
                    const candidate = [...fallbackStations].sort((left, right) => {
                        const leftLoad = stationLoadCounts.get(left.id) ?? 0;
                        const rightLoad = stationLoadCounts.get(right.id) ?? 0;
                        if (leftLoad !== rightLoad)
                            return leftLoad - rightLoad;
                        return asNumber(left.sort_order) - asNumber(right.sort_order);
                    })[0];
                    return candidate ?? null;
                };
                const pickReplacementDeviceId = (replacementStationId) => {
                    const devices = activeDevicesByStation.get(replacementStationId) ?? [];
                    if (!devices.length)
                        return null;
                    const selected = [...devices].sort((left, right) => {
                        const leftId = asTrimmedString(left.device_id);
                        const rightId = asTrimmedString(right.device_id);
                        const leftLoad = deviceLoadCounts.get(leftId) ?? 0;
                        const rightLoad = deviceLoadCounts.get(rightId) ?? 0;
                        if (leftLoad !== rightLoad)
                            return leftLoad - rightLoad;
                        return leftId.localeCompare(rightId);
                    })[0];
                    const selectedId = asTrimmedString(selected?.device_id);
                    if (!selectedId)
                        return null;
                    deviceLoadCounts.set(selectedId, (deviceLoadCounts.get(selectedId) ?? 0) + 1);
                    return selectedId;
                };
                if (activeItemDocs.length > 0 && fallbackStations.length === 0) {
                    logger.warn("delete_station: deleting last available station with active items; items will be unassigned", {
                        tenantId,
                        stationId,
                        activeItems: activeItemDocs.length,
                    });
                }
                const batch = access.firestore.batch();
                const now = new Date().toISOString();
                assignedDevicesSnap.docs.forEach((deviceSnap) => {
                    const deviceData = (deviceSnap.data() ?? {});
                    if (isDeletedKdsDeviceData(deviceData))
                        return;
                    batch.set(deviceSnap.ref, {
                        station_id: null,
                        updated_at: now,
                    }, { merge: true });
                });
                for (const itemSnap of activeItemDocs) {
                    const replacementStation = pickReplacementStation();
                    const replacementDeviceId = replacementStation ? pickReplacementDeviceId(replacementStation.id) : null;
                    if (replacementStation) {
                        stationLoadCounts.set(replacementStation.id, (stationLoadCounts.get(replacementStation.id) ?? 0) + 1);
                    }
                    else {
                        logger.warn("delete_station: active item left unassigned after station deletion", {
                            tenantId,
                            stationId,
                            itemId: itemSnap.id,
                        });
                    }
                    batch.set(itemSnap.ref, {
                        current_station_id: replacementStation?.id ?? null,
                        current_device_id: replacementDeviceId,
                        station_status: "waiting",
                        station_started_at: null,
                        station_completed_at: null,
                        claimed_by_device_id: null,
                        claimed_at: null,
                        updated_at: now,
                    }, { merge: true });
                }
                batch.set(stationRef, {
                    is_active: false,
                    deleted_at: now,
                    updated_at: now,
                }, { merge: true });
                await batch.commit();
                json(res, 200, { success: true });
                return;
            }
            if (action === "toggle_station_active") {
                const stationId = asTrimmedString(req.body?.station_id);
                if (!stationId) {
                    json(res, 400, { error: "station_id e obrigatorio" });
                    return;
                }
                const stationRef = access.tenantRef.collection("kds_stations").doc(stationId);
                const stationSnap = await stationRef.get();
                if (!stationSnap.exists) {
                    json(res, 404, { error: "Praca nao encontrada" });
                    return;
                }
                await stationRef.set({
                    is_active: Boolean(req.body?.is_active),
                    updated_at: new Date().toISOString(),
                }, { merge: true });
                const updatedSnap = await stationRef.get();
                json(res, 200, { station: toStationResponse(docRow(updatedSnap)) });
                return;
            }
            if (action === "reorder_stations") {
                const orderedIds = asStringArray(req.body?.ordered_ids);
                if (!orderedIds.length) {
                    json(res, 400, { error: "ordered_ids e obrigatorio" });
                    return;
                }
                const now = new Date().toISOString();
                const batch = access.firestore.batch();
                orderedIds.forEach((stationId, index) => {
                    const stationRef = access.tenantRef.collection("kds_stations").doc(stationId);
                    batch.set(stationRef, {
                        sort_order: index,
                        updated_at: now,
                    }, { merge: true });
                });
                await batch.commit();
                json(res, 200, { success: true });
                return;
            }
        }
        if (!tenantId || !deviceId) {
            json(res, 400, { error: "device_id e tenant_id sao obrigatorios" });
            return;
        }
        const access = await requireKdsDeviceAccess(req, res, tenantId, deviceId);
        if (!access)
            return;
        if (action === "get_settings") {
            const settings = await getKdsSettingsDoc(access.tenantRef);
            json(res, 200, { settings: settings?.data ?? null });
            return;
        }
        if (action === "get_stations") {
            const stations = await listKdsStationsDocs(access.tenantRef);
            json(res, 200, {
                stations: stations.map((station) => ({ id: station.id, ...station.data })),
            });
            return;
        }
        if (action === "get_orders" || action === "get_all") {
            const statuses = asStringArray(req.body?.statuses, ["pending", "preparing", "ready", "delivered", "cancelled"]);
            const [orders, settings, stations] = await Promise.all([
                buildKdsOrders(access.tenantRef, statuses, { deviceId }),
                action === "get_all" ? getKdsSettingsDoc(access.tenantRef) : Promise.resolve(null),
                action === "get_all" ? listKdsStationsDocs(access.tenantRef) : Promise.resolve([]),
            ]);
            if (action === "get_orders") {
                json(res, 200, { orders });
                return;
            }
            json(res, 200, {
                orders,
                device: sanitizeKdsDevice(access.deviceSnap.id, tenantId, (access.deviceSnap.data() ?? {})),
                settings: settings?.data ?? null,
                stations: stations.map((station) => ({ id: station.id, ...station.data })),
            });
            return;
        }
        if (action === "get_station_history") {
            const stationId = asTrimmedString(req.body?.station_id) ||
                asTrimmedString(access.deviceSnap.data()?.station_id);
            const limitCount = Math.min(Math.max(asNumber(req.body?.limit, 30), 1), 50);
            if (!stationId) {
                json(res, 400, { error: "station_id e obrigatorio" });
                return;
            }
            const logsSnapshot = await access.tenantRef
                .collection("kds_station_logs")
                .where("station_id", "==", stationId)
                .where("action", "==", "completed")
                .get();
            const orderedLogs = logsSnapshot.docs
                .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() ?? {}) }))
                .sort((left, right) => asTrimmedString(right.created_at).localeCompare(asTrimmedString(left.created_at)))
                .slice(0, limitCount);
            const orderItemIds = Array.from(new Set(orderedLogs.map((entry) => asTrimmedString(entry.order_item_id)).filter(Boolean)));
            const orderItemSnaps = await Promise.all(orderItemIds.map((orderItemId) => access.tenantRef.collection("order_items").doc(orderItemId).get()));
            const orderItems = orderItemSnaps
                .filter((snap) => snap.exists)
                .map((snap) => ({ id: snap.id, ...(snap.data() ?? {}) }));
            const orderItemMap = new Map(orderItems.map((item) => [item.id, item]));
            const orderIds = Array.from(new Set(orderItems.map((item) => asTrimmedString(item.order_id)).filter(Boolean)));
            const productIds = Array.from(new Set(orderItems.map((item) => asTrimmedString(item.product_id)).filter(Boolean)));
            const variationIds = Array.from(new Set(orderItems.map((item) => asTrimmedString(item.variation_id)).filter(Boolean)));
            const orderSnaps = await Promise.all(orderIds.map((orderId) => access.tenantRef.collection("orders").doc(orderId).get()));
            const ordersMap = new Map(orderSnaps
                .filter((snap) => snap.exists)
                .map((snap) => [snap.id, (snap.data() ?? {})]));
            const productSnaps = await Promise.all(productIds.map((productId) => access.tenantRef.collection("products").doc(productId).get()));
            const productMap = new Map(productSnaps
                .filter((snap) => snap.exists)
                .map((snap) => [snap.id, (snap.data() ?? {})]));
            const variationSnaps = await Promise.all(variationIds.map((variationId) => access.tenantRef.collection("product_variations").doc(variationId).get()));
            const variationMap = new Map(variationSnaps
                .filter((snap) => snap.exists)
                .map((snap) => [snap.id, (snap.data() ?? {})]));
            const tableIds = Array.from(new Set(Array.from(ordersMap.values())
                .map((order) => asTrimmedString(order.table_id))
                .filter(Boolean)));
            const tableSnaps = await Promise.all(tableIds.map((tableId) => access.tenantRef.collection("tables").doc(tableId).get()));
            const tableMap = new Map(tableSnaps
                .filter((snap) => snap.exists)
                .map((snap) => [snap.id, (snap.data() ?? {})]));
            const history = orderedLogs.map((entry) => {
                const orderItemId = asTrimmedString(entry.order_item_id);
                const orderItem = orderItemMap.get(orderItemId) ?? null;
                const order = orderItem ? ordersMap.get(asTrimmedString(orderItem.order_id)) ?? null : null;
                const table = order ? tableMap.get(asTrimmedString(order.table_id)) ?? null : null;
                const product = orderItem ? productMap.get(asTrimmedString(orderItem.product_id)) ?? null : null;
                const variation = orderItem ? variationMap.get(asTrimmedString(orderItem.variation_id)) ?? null : null;
                return {
                    id: entry.id,
                    action: asTrimmedString(entry.action),
                    created_at: asTrimmedString(entry.created_at),
                    order_item_id: orderItemId,
                    order_item: orderItem
                        ? {
                            id: orderItem.id,
                            quantity: asNumber(orderItem.quantity, 1),
                            notes: asNullableString(orderItem.notes),
                            order_id: asTrimmedString(orderItem.order_id),
                            product: product ? { name: asTrimmedString(product.name) || "Produto" } : null,
                            variation: variation ? { name: asTrimmedString(variation.name) } : null,
                            order: order
                                ? {
                                    id: asTrimmedString(order.id) || asTrimmedString(orderItem.order_id),
                                    order_type: asTrimmedString(order.order_type) || "dine_in",
                                    customer_name: asNullableString(order.customer_name),
                                    table: table ? { number: asNumber(table.number) } : null,
                                }
                                : null,
                        }
                        : null,
                };
            });
            json(res, 200, { history });
            return;
        }
        if (action === "claim_item") {
            const itemId = asTrimmedString(req.body?.item_id);
            if (!itemId) {
                json(res, 400, { error: "item_id e obrigatorio" });
                return;
            }
            const deviceStationId = asTrimmedString(access.deviceSnap.data()?.station_id);
            if (!deviceStationId) {
                json(res, 409, { error: "Dispositivo sem setor vinculado" });
                return;
            }
            const deviceRows = await listKdsDevicesDocs(access.tenantRef);
            const activeStationIds = new Set(deviceRows
                .map((row) => row.data)
                .filter((device) => device.is_active !== false)
                .filter((device) => isRecentIso(asNullableString(device.last_seen_at), KDS_DEVICE_ONLINE_WINDOW_MS))
                .map((device) => asTrimmedString(device.station_id))
                .filter(Boolean));
            const now = new Date().toISOString();
            let stationId = "";
            let shouldLogStarted = false;
            try {
                await access.firestore.runTransaction(async (transaction) => {
                    const itemRef = access.tenantRef.collection("order_items").doc(itemId);
                    const itemSnap = await transaction.get(itemRef);
                    if (!itemSnap.exists) {
                        throw new Error("Item nao encontrado");
                    }
                    const itemData = (itemSnap.data() ?? {});
                    const originalStationId = asTrimmedString(itemData.current_station_id);
                    const currentDeviceId = asNullableString(itemData.current_device_id);
                    const claimedByDeviceId = asNullableString(itemData.claimed_by_device_id);
                    const claimedAt = asNullableString(itemData.claimed_at);
                    const stationStatus = asTrimmedString(itemData.station_status);
                    const itemStatus = asTrimmedString(itemData.status);
                    const canRebindToCurrentDeviceStation = !!deviceStationId &&
                        stationStatus === "waiting" &&
                        (!originalStationId || !activeStationIds.has(originalStationId));
                    stationId = canRebindToCurrentDeviceStation ? deviceStationId : originalStationId;
                    if (!stationId) {
                        throw new Error("Item nao esta em um setor ativo");
                    }
                    if (deviceStationId && stationId !== deviceStationId) {
                        throw new Error("Item nao pertence a este dispositivo");
                    }
                    if (asNullableString(itemData.cancelled_at) || asNullableString(itemData.served_at)) {
                        throw new Error("Item nao pode mais ser iniciado");
                    }
                    if (itemStatus === "cancelled" || itemStatus === "delivered") {
                        throw new Error("Item nao pode mais ser iniciado");
                    }
                    if (claimedByDeviceId && claimedByDeviceId !== deviceId && isRecentIso(claimedAt, KDS_CLAIM_TTL_MS)) {
                        throw new Error("Item ja esta em uso em outro dispositivo");
                    }
                    if (stationStatus === "completed" || stationStatus === "done") {
                        throw new Error("Item nao pode mais ser iniciado");
                    }
                    const alreadyClaimedByThisDevice = stationStatus === "in_progress" &&
                        claimedByDeviceId === deviceId &&
                        isRecentIso(claimedAt, KDS_CLAIM_TTL_MS);
                    transaction.set(itemRef, {
                        current_station_id: stationId,
                        current_device_id: deviceId,
                        station_status: "in_progress",
                        station_started_at: asNullableString(itemData.station_started_at) ?? now,
                        claimed_by_device_id: deviceId,
                        claimed_at: now,
                        updated_at: now,
                    }, { merge: true });
                    shouldLogStarted = !alreadyClaimedByThisDevice;
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "Nao foi possivel iniciar o item";
                json(res, message === "Item nao encontrado" ? 404 : 409, { error: message });
                return;
            }
            if (shouldLogStarted && stationId) {
                await createKdsStationLogEntry(access.tenantRef, tenantId, {
                    order_item_id: itemId,
                    station_id: stationId,
                    action: "started",
                    performed_by: deviceId,
                }).catch(() => undefined);
            }
            json(res, 200, { success: true, station_id: stationId });
            return;
        }
        if (action === "update_item_station") {
            const itemId = asTrimmedString(req.body?.item_id);
            const stationId = req.body?.station_id === null ? null : asNullableString(req.body?.station_id);
            const stationStatus = req.body?.station_status === null ? null : asNullableString(req.body?.station_status);
            if (!itemId) {
                json(res, 400, { error: "item_id e obrigatorio" });
                return;
            }
            const itemRef = access.tenantRef.collection("order_items").doc(itemId);
            const itemSnap = await itemRef.get();
            if (!itemSnap.exists) {
                json(res, 404, { error: "Item nao encontrado" });
                return;
            }
            const itemData = (itemSnap.data() ?? {});
            const now = new Date().toISOString();
            const updates = { updated_at: now };
            if (req.body?.station_id !== undefined)
                updates.current_station_id = stationId;
            if (req.body?.station_status !== undefined)
                updates.station_status = stationStatus;
            if (stationStatus === "in_progress") {
                updates.station_started_at = asNullableString(itemData.station_started_at) ?? now;
                updates.current_device_id = deviceId;
                updates.claimed_by_device_id = deviceId;
                updates.claimed_at = now;
            }
            if (stationStatus === "completed")
                updates.station_completed_at = now;
            if (stationStatus !== "in_progress") {
                updates.claimed_by_device_id = null;
                updates.claimed_at = null;
            }
            await itemRef.set(updates, { merge: true });
            json(res, 200, { success: true });
            return;
        }
        if (action === "update_order_status") {
            const orderId = asTrimmedString(req.body?.order_id);
            const status = asTrimmedString(req.body?.status);
            if (!orderId || !status) {
                json(res, 400, { error: "order_id e status sao obrigatorios" });
                return;
            }
            const orderRef = access.tenantRef.collection("orders").doc(orderId);
            const orderSnap = await orderRef.get();
            if (!orderSnap.exists) {
                json(res, 404, { error: "Pedido nao encontrado" });
                return;
            }
            const now = new Date().toISOString();
            const updates = { status, updated_at: now };
            if (status === "ready")
                updates.ready_at = now;
            if (status === "delivered")
                updates.delivered_at = now;
            await orderRef.set(updates, { merge: true });
            json(res, 200, { success: true });
            return;
        }
        if (action === "finalize_order_from_status") {
            const orderId = asTrimmedString(req.body?.order_id);
            const orderType = asTrimmedString(req.body?.order_type);
            const currentStationId = asTrimmedString(req.body?.current_station_id);
            if (!orderId) {
                json(res, 400, { error: "order_id e obrigatorio" });
                return;
            }
            const [orderSnap, stationRows] = await Promise.all([
                access.tenantRef.collection("orders").doc(orderId).get(),
                listKdsStationsDocs(access.tenantRef),
            ]);
            if (!orderSnap.exists) {
                json(res, 404, { error: "Pedido nao encontrado" });
                return;
            }
            const activeStations = stationRows
                .map((row) => ({ id: row.id, ...row.data }))
                .filter((station) => station.is_active !== false)
                .sort((left, right) => asNumber(left.sort_order) - asNumber(right.sort_order));
            const now = new Date().toISOString();
            const orderItemsSnapshot = await access.tenantRef.collection("order_items").where("order_id", "==", orderId).get();
            const orderItems = orderItemsSnapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ref: docSnap.ref,
                data: (docSnap.data() ?? {}),
            }));
            if (orderType === "dine_in" && currentStationId) {
                const currentStation = activeStations.find((station) => station.id === currentStationId) ?? null;
                const nextOrderStatusStation = currentStation
                    ? activeStations
                        .filter((station) => asTrimmedString(station.station_type) === "order_status" &&
                        asNumber(station.sort_order) > asNumber(currentStation.sort_order))
                        .sort((left, right) => asNumber(left.sort_order) - asNumber(right.sort_order))[0] ?? null
                    : null;
                if (nextOrderStatusStation) {
                    const deviceRows = await listKdsDevicesDocs(access.tenantRef);
                    const stationDataMap = new Map(stationRows.map((row) => [row.id, row.data]));
                    const resolvedDevices = deviceRows
                        .map((row) => resolveKdsDeviceRow(row, stationDataMap))
                        .filter((device) => device.is_active && !!device.device_id && !!device.station_id);
                    const nextStationDevices = resolvedDevices.filter((device) => device.station_id === nextOrderStatusStation.id);
                    const onlineNextStationDevices = nextStationDevices.filter(isResolvedDeviceOnline);
                    const candidateDevices = onlineNextStationDevices.length > 0 ? onlineNextStationDevices : nextStationDevices;
                    if (!candidateDevices.length) {
                        json(res, 409, { error: "Nenhum dispositivo vinculado ao proximo setor" });
                        return;
                    }
                    const candidateDeviceIds = candidateDevices.map((device) => device.device_id);
                    const deviceLoadCounts = await getDeviceLoadCounts(access.tenantRef, candidateDeviceIds);
                    const selectedNextDeviceId = pickLeastLoadedDeviceId(candidateDevices, deviceLoadCounts);
                    if (!selectedNextDeviceId) {
                        json(res, 409, { error: "Nao foi possivel resolver o dispositivo do proximo setor" });
                        return;
                    }
                    for (const item of orderItems) {
                        const itemCurrentStationId = asTrimmedString(item.data.current_station_id);
                        if (itemCurrentStationId) {
                            await createKdsStationLogEntry(access.tenantRef, tenantId, {
                                order_item_id: item.id,
                                station_id: itemCurrentStationId,
                                action: "completed",
                            }).catch(() => undefined);
                        }
                        await item.ref.set({
                            current_station_id: nextOrderStatusStation.id,
                            current_device_id: selectedNextDeviceId,
                            station_status: "waiting",
                            station_started_at: null,
                            station_completed_at: now,
                            claimed_by_device_id: null,
                            claimed_at: null,
                            updated_at: now,
                        }, { merge: true });
                        await createKdsStationLogEntry(access.tenantRef, tenantId, {
                            order_item_id: item.id,
                            station_id: nextOrderStatusStation.id,
                            action: "entered",
                        }).catch(() => undefined);
                    }
                    json(res, 200, {
                        success: true,
                        moved_to_station_id: nextOrderStatusStation.id,
                        moved_to_device_id: selectedNextDeviceId,
                    });
                    return;
                }
            }
            for (const item of orderItems) {
                const itemCurrentStationId = asTrimmedString(item.data.current_station_id);
                if (itemCurrentStationId && asTrimmedString(activeStations.find((station) => station.id === itemCurrentStationId)?.station_type) === "order_status") {
                    await createKdsStationLogEntry(access.tenantRef, tenantId, {
                        order_item_id: item.id,
                        station_id: itemCurrentStationId,
                        action: "completed",
                    }).catch(() => undefined);
                }
                await item.ref.set({
                    current_station_id: null,
                    current_device_id: null,
                    station_status: "done",
                    station_started_at: null,
                    station_completed_at: now,
                    claimed_by_device_id: null,
                    claimed_at: null,
                    status: "delivered",
                    served_at: asNullableString(item.data.served_at) || now,
                    updated_at: now,
                }, { merge: true });
            }
            await orderSnap.ref.set({
                status: "delivered",
                delivered_at: now,
                updated_at: now,
            }, { merge: true });
            json(res, 200, { success: true });
            return;
        }
        if (action === "log_station") {
            const itemId = asTrimmedString(req.body?.order_item_id);
            const stationId = asTrimmedString(req.body?.station_id);
            const logAction = asTrimmedString(req.body?.action);
            if (!itemId || !stationId || !logAction) {
                json(res, 400, { error: "order_item_id, station_id e action sao obrigatorios" });
                return;
            }
            await createKdsStationLogEntry(access.tenantRef, tenantId, {
                order_item_id: itemId,
                station_id: stationId,
                action: logAction,
                duration_seconds: asNullableNumber(req.body?.duration_seconds),
                notes: asNullableString(req.body?.notes),
            });
            json(res, 200, { success: true });
            return;
        }
        if (action === "smart_move_item") {
            const itemId = asTrimmedString(req.body?.item_id);
            const currentStationId = asTrimmedString(req.body?.current_station_id);
            if (!itemId || !currentStationId) {
                json(res, 400, { error: "item_id e current_station_id sao obrigatorios" });
                return;
            }
            const [itemSnap, stationRows] = await Promise.all([
                access.tenantRef.collection("order_items").doc(itemId).get(),
                listKdsStationsDocs(access.tenantRef),
            ]);
            if (!itemSnap.exists) {
                json(res, 404, { error: "Item nao encontrado" });
                return;
            }
            const itemData = (itemSnap.data() ?? {});
            const currentItemStationId = asTrimmedString(itemData.current_station_id);
            const claimedByDeviceId = asNullableString(itemData.claimed_by_device_id);
            const currentDeviceId = asNullableString(itemData.current_device_id);
            const stationStatus = asTrimmedString(itemData.station_status);
            const itemStatus = asTrimmedString(itemData.status);
            const deviceStationId = asTrimmedString(access.deviceSnap.data()?.station_id);
            const orderId = asTrimmedString(itemData.order_id);
            const activeStations = stationRows
                .map((row) => ({ id: row.id, ...row.data }))
                .filter((station) => station.is_active !== false)
                .sort((left, right) => asNumber(left.sort_order) - asNumber(right.sort_order));
            const currentStation = activeStations.find((station) => station.id === currentStationId);
            if (!currentStation) {
                json(res, 404, { error: "Estacao atual nao encontrada" });
                return;
            }
            const canHealCurrentStation = !!deviceStationId &&
                currentStationId === deviceStationId &&
                stationStatus === "in_progress" &&
                claimedByDeviceId === deviceId;
            const effectiveCurrentStationId = canHealCurrentStation ? currentStationId : currentItemStationId;
            if (effectiveCurrentStationId !== currentStationId) {
                json(res, 409, { error: "Item nao esta mais nesta praca" });
                return;
            }
            if (asNullableString(itemData.cancelled_at) || asNullableString(itemData.served_at)) {
                json(res, 409, { error: "Item nao pode mais ser movido" });
                return;
            }
            if (itemStatus === "cancelled" || itemStatus === "delivered") {
                json(res, 409, { error: "Item nao pode mais ser movido" });
                return;
            }
            const effectiveCurrentDeviceId = currentDeviceId && currentDeviceId !== deviceId && claimedByDeviceId === deviceId
                ? deviceId
                : currentDeviceId;
            if (effectiveCurrentDeviceId && effectiveCurrentDeviceId !== deviceId) {
                json(res, 409, { error: "Item pertence a outro dispositivo" });
                return;
            }
            const orderSnap = orderId ? await access.tenantRef.collection("orders").doc(orderId).get() : null;
            const orderType = orderSnap?.exists ? asTrimmedString(orderSnap.data()?.order_type) : "";
            const nextStations = getNextStationsInFlow(activeStations, currentStationId, orderType);
            const isTerminalStage = nextStations.length === 0;
            const canCompleteTerminalStageDirectly = isTerminalStage && stationStatus === "waiting";
            if (stationStatus !== "in_progress" && !canCompleteTerminalStageDirectly) {
                json(res, 409, { error: "Inicie o item antes de avancar" });
                return;
            }
            if (!canCompleteTerminalStageDirectly && claimedByDeviceId !== deviceId) {
                json(res, 409, { error: "Item nao esta claimed por este dispositivo" });
                return;
            }
            const deviceRows = await listKdsDevicesDocs(access.tenantRef);
            const stationDataMap = new Map(stationRows.map((row) => [row.id, row.data]));
            const resolvedDevices = deviceRows
                .map((row) => resolveKdsDeviceRow(row, stationDataMap))
                .filter((device) => device.is_active && !!device.device_id && !!device.station_id);
            const resolvedDeviceByPublicId = new Map(resolvedDevices.map((device) => [device.device_id, device]));
            const devicesByStation = new Map();
            const onlineDevicesByStation = new Map();
            resolvedDevices.forEach((device) => {
                if (!device.station_id)
                    return;
                const current = devicesByStation.get(device.station_id) ?? [];
                current.push(device);
                devicesByStation.set(device.station_id, current);
            });
            resolvedDevices.filter(isResolvedDeviceOnline).forEach((device) => {
                if (!device.station_id)
                    return;
                const current = onlineDevicesByStation.get(device.station_id) ?? [];
                current.push(device);
                onlineDevicesByStation.set(device.station_id, current);
            });
            let targetStationId = null;
            let targetDeviceId = null;
            let targetStation = null;
            if (!isTerminalStage) {
                const candidateNextDevices = getCandidateDevicesForStations(nextStations, devicesByStation, onlineDevicesByStation);
                if (!candidateNextDevices.length) {
                    json(res, 409, { error: "Nenhum dispositivo vinculado ao proximo setor" });
                    return;
                }
                const candidateDeviceIds = candidateNextDevices.map((device) => device.device_id);
                const preferredDeviceId = orderId
                    ? await getPreferredOrderDeviceId(access.tenantRef, orderId, new Set(candidateDeviceIds), itemId)
                    : null;
                const deviceLoadCounts = await getDeviceLoadCounts(access.tenantRef, candidateDeviceIds, itemId);
                const selectedNextDeviceId = pickLeastLoadedDeviceId(candidateNextDevices, deviceLoadCounts, preferredDeviceId);
                const configuredNextDevice = selectedNextDeviceId
                    ? resolvedDeviceByPublicId.get(selectedNextDeviceId) ?? null
                    : null;
                if (!configuredNextDevice || !configuredNextDevice.station_id) {
                    json(res, 409, { error: "Nao foi possivel resolver o dispositivo do proximo setor" });
                    return;
                }
                targetStationId = configuredNextDevice.station_id;
                targetStation =
                    nextStations.find((station) => station.id === configuredNextDevice.station_id) ??
                        activeStations.find((station) => station.id === configuredNextDevice.station_id) ??
                        null;
                targetDeviceId = configuredNextDevice.device_id;
            }
            const now = new Date().toISOString();
            await itemSnap.ref.set({
                current_station_id: targetStationId,
                current_device_id: targetDeviceId,
                station_status: targetStationId ? "waiting" : "done",
                station_started_at: null,
                station_completed_at: now,
                claimed_by_device_id: null,
                claimed_at: null,
                status: targetStationId ? itemData.status ?? "pending" : "ready",
                ready_at: targetStationId ? null : now,
                updated_at: now,
            }, { merge: true });
            await createKdsStationLogEntry(access.tenantRef, tenantId, {
                order_item_id: itemId,
                station_id: currentStationId,
                action: "completed",
            }).catch(() => undefined);
            if (targetStationId) {
                await createKdsStationLogEntry(access.tenantRef, tenantId, {
                    order_item_id: itemId,
                    station_id: targetStationId,
                    action: "entered",
                }).catch(() => undefined);
            }
            if (!targetStationId || asTrimmedString(targetStation?.station_type) === "order_status") {
                if (orderId && orderSnap?.exists) {
                    const orderItemsSnapshot = await access.tenantRef.collection("order_items").where("order_id", "==", orderId).get();
                    const orderStatusStationIds = new Set(activeStations
                        .filter((station) => asTrimmedString(station.station_type) === "order_status")
                        .map((station) => station.id));
                    const allItemsReady = orderItemsSnapshot.docs.every((docSnap) => {
                        const row = (docSnap.data() ?? {});
                        const currentItemStationId = docSnap.id === itemId ? targetStationId : asNullableString(row.current_station_id);
                        const currentItemStationStatus = docSnap.id === itemId ? (targetStationId ? "waiting" : "done") : asTrimmedString(row.station_status);
                        return (currentItemStationId && orderStatusStationIds.has(currentItemStationId)) || currentItemStationStatus === "done";
                    });
                    if (allItemsReady) {
                        await orderSnap.ref.set({
                            status: "ready",
                            ready_at: now,
                            updated_at: now,
                        }, { merge: true });
                    }
                }
            }
            json(res, 200, { success: true, target_station_id: targetStationId, target_device_id: targetDeviceId });
            return;
        }
        json(res, 400, { error: "Acao invalida" });
    }
    catch (error) {
        logger.error("kdsData failed", { error, body: req.body });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
//# sourceMappingURL=kds.js.map