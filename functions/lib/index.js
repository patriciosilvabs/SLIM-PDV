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
exports.publicStore = exports.productionWebhook = exports.productionApi = exports.elevenlabsTts = exports.openaiTts = exports.sendReopenNotification = exports.replicateMenu = exports.cardapiowebWebhook = exports.cardapiowebSyncOrders = exports.cardapiowebSyncStatus = exports.qzSign = exports.deleteUser = exports.adminDeleteUser = exports.adminUpdateUser = exports.createUser = exports.bootstrapTenant = exports.platformAdminUpdateTenantStatus = exports.platformAdminDeleteAdmin = exports.platformAdminCreateAdmin = exports.acceptTenantInvitation = exports.tenantInvitationInfo = exports.checkTenantSlugAvailability = exports.health = exports.kdsDeviceAuth = exports.kdsData = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
var kds_1 = require("./kds");
Object.defineProperty(exports, "kdsData", { enumerable: true, get: function () { return kds_1.kdsData; } });
Object.defineProperty(exports, "kdsDeviceAuth", { enumerable: true, get: function () { return kds_1.kdsDeviceAuth; } });
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
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
        const decoded = await (0, auth_1.getAuth)().verifyIdToken(token);
        return decoded;
    }
    catch (error) {
        logger.error("Token validation failed", error);
        json(res, 401, { error: "Usuario nao autenticado" });
        return null;
    }
}
async function requirePlatformAdmin(req, res) {
    const caller = await requireAuth(req, res);
    if (!caller) {
        return null;
    }
    const firestore = (0, firestore_1.getFirestore)();
    const adminByUserId = await firestore
        .collection("platform_admins")
        .where("user_id", "==", caller.uid)
        .limit(1)
        .get();
    if (!adminByUserId.empty) {
        return caller;
    }
    const callerEmail = typeof caller.email === "string" ? caller.email.toLowerCase().trim() : "";
    if (callerEmail) {
        const adminByEmail = await firestore
            .collection("platform_admins")
            .where("email", "==", callerEmail)
            .limit(1)
            .get();
        if (!adminByEmail.empty) {
            return caller;
        }
    }
    json(res, 403, { error: "Acesso restrito a administradores da plataforma" });
    return null;
}
const ORPHAN_TENANT_RELEASE_AGE_MS = 10 * 60 * 1000;
const BOOTSTRAP_TENANT_COLLECTION_LIMITS = {
    tenant_members: 1,
    user_roles: 1,
    kds_global_settings: 1,
    kds_stations: 5,
    tables: 10,
};
async function deleteOrphanTenantArtifacts(firestore, tenantId) {
    const tenantRef = firestore.collection("tenants").doc(tenantId);
    const legacyMemberships = await firestore
        .collection("tenant_memberships")
        .where("tenant_id", "==", tenantId)
        .get();
    if (!legacyMemberships.empty) {
        const batch = firestore.batch();
        legacyMemberships.docs.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });
        await batch.commit();
    }
    await firestore.recursiveDelete(tenantRef);
}
async function isCallerOwnedBootstrapShell(tenantSnap, callerUid) {
    const tenantData = tenantSnap.data();
    const ownerId = typeof tenantData.owner_id === "string" ? tenantData.owner_id : null;
    if (ownerId !== callerUid) {
        return false;
    }
    const subcollections = await tenantSnap.ref.listCollections();
    for (const subcollection of subcollections) {
        if (!(subcollection.id in BOOTSTRAP_TENANT_COLLECTION_LIMITS)) {
            return false;
        }
        const limit = BOOTSTRAP_TENANT_COLLECTION_LIMITS[subcollection.id] + 1;
        const snapshot = await subcollection.limit(limit).get();
        if (snapshot.size >= limit) {
            return false;
        }
        if (subcollection.id === "tenant_members") {
            if (snapshot.empty)
                continue;
            const member = snapshot.docs[0].data();
            if (member.user_id !== callerUid || member.is_owner !== true) {
                return false;
            }
            continue;
        }
        if (subcollection.id === "user_roles") {
            if (snapshot.empty)
                continue;
            const role = snapshot.docs[0].data();
            if (role.user_id !== callerUid || role.role !== "admin") {
                return false;
            }
            continue;
        }
    }
    return true;
}
async function resolveTenantSlugAvailability(firestore, slug, callerUid) {
    const matchingTenants = await firestore.collection("tenants").where("slug", "==", slug).get();
    if (matchingTenants.empty) {
        return { available: true, cleanedTenantIds: [] };
    }
    const cleanedTenantIds = [];
    for (const tenantSnap of matchingTenants.docs) {
        const tenantData = tenantSnap.data();
        const tenantMembers = await tenantSnap.ref.collection("tenant_members").limit(1).get();
        const ownerId = typeof tenantData.owner_id === "string" ? tenantData.owner_id : null;
        const callerOwnedBootstrapShell = await isCallerOwnedBootstrapShell(tenantSnap, callerUid);
        if (!tenantMembers.empty && !callerOwnedBootstrapShell) {
            return {
                available: false,
                cleanedTenantIds,
                blockingTenantId: tenantSnap.id,
            };
        }
        if (callerOwnedBootstrapShell) {
            await deleteOrphanTenantArtifacts(firestore, tenantSnap.id);
            cleanedTenantIds.push(tenantSnap.id);
            logger.warn("Released caller-owned bootstrap tenant slug", {
                slug,
                tenantId: tenantSnap.id,
                callerUid,
            });
            continue;
        }
        const createdAt = typeof tenantData.created_at === "string" ? new Date(tenantData.created_at).getTime() : Number.NaN;
        const isOldEnough = Number.isFinite(createdAt)
            ? Date.now() - createdAt >= ORPHAN_TENANT_RELEASE_AGE_MS
            : true;
        const canRelease = ownerId === callerUid || isOldEnough;
        if (!canRelease) {
            return {
                available: false,
                cleanedTenantIds,
                blockingTenantId: tenantSnap.id,
            };
        }
        await deleteOrphanTenantArtifacts(firestore, tenantSnap.id);
        cleanedTenantIds.push(tenantSnap.id);
        logger.warn("Released orphan tenant slug", {
            slug,
            tenantId: tenantSnap.id,
            callerUid,
            ownerId,
            createdAt: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : null,
        });
    }
    return { available: true, cleanedTenantIds };
}
function notImplemented(name) {
    return (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
        if (handlePreflight(req, res))
            return;
        logger.info(`${name} called`);
        json(res, 501, { error: `Not implemented yet. Migrate ${name} logic to Firebase.` });
    });
}
function normalizePemValue(value) {
    return value.replace(/\\n/g, "\n").trim();
}
function readQzPrivateKey() {
    const inlinePrivateKey = process.env.QZ_PRIVATE_KEY;
    if (inlinePrivateKey) {
        return normalizePemValue(inlinePrivateKey);
    }
    const base64PrivateKey = process.env.QZ_PRIVATE_KEY_BASE64;
    if (base64PrivateKey) {
        return Buffer.from(base64PrivateKey, "base64").toString("utf8").trim();
    }
    const privateKeyPath = process.env.QZ_PRIVATE_KEY_PATH;
    if (privateKeyPath) {
        try {
            return (0, node_fs_1.readFileSync)(privateKeyPath, "utf8").trim();
        }
        catch (error) {
            logger.error("Failed to read QZ private key file", { privateKeyPath, error });
            return null;
        }
    }
    return null;
}
function proxyToSupabase(edgeFunctionName) {
    return (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
        if (handlePreflight(req, res))
            return;
        const supabaseUrl = process.env.SUPABASE_URL;
        if (!supabaseUrl) {
            json(res, 501, { error: "SUPABASE_URL is not configured for proxy fallback" });
            return;
        }
        try {
            const url = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/${edgeFunctionName}`;
            const headers = {
                "Content-Type": "application/json",
            };
            if (typeof req.headers.authorization === "string") {
                headers.Authorization = req.headers.authorization;
            }
            const response = await fetch(url, {
                method: req.method || "POST",
                headers,
                body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
            });
            const text = await response.text();
            cors(res);
            res.status(response.status);
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                try {
                    res.json(text ? JSON.parse(text) : {});
                    return;
                }
                catch {
                    res.send(text);
                    return;
                }
            }
            res.send(text);
        }
        catch (error) {
            logger.error(`Proxy failed for ${edgeFunctionName}`, error);
            const message = error instanceof Error ? error.message : "Proxy error";
            json(res, 500, { error: message });
        }
    });
}
exports.health = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    json(res, 200, { ok: true, service: "slim-pdv-functions" });
});
exports.checkTenantSlugAvailability = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    const rawSlug = (typeof req.body?.slug === "string" ? req.body.slug : undefined) ??
        (typeof req.query.slug === "string" ? req.query.slug : undefined);
    const normalizedSlug = typeof rawSlug === "string" ? rawSlug.trim().toLowerCase() : "";
    if (!/^[a-z0-9-]{3,50}$/.test(normalizedSlug)) {
        json(res, 400, { error: "Slug invalido" });
        return;
    }
    try {
        const firestore = (0, firestore_1.getFirestore)();
        const slugStatus = await resolveTenantSlugAvailability(firestore, normalizedSlug, caller.uid);
        json(res, 200, {
            available: slugStatus.available,
            cleaned_orphan_tenant_ids: slugStatus.cleanedTenantIds,
            blocking_tenant_id: slugStatus.blockingTenantId ?? null,
        });
    }
    catch (error) {
        logger.error("checkTenantSlugAvailability failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.tenantInvitationInfo = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const rawToken = (typeof req.body?.token === "string" ? req.body.token : undefined) ??
        (typeof req.query.token === "string" ? req.query.token : undefined);
    const token = rawToken?.trim();
    if (!token) {
        json(res, 400, { error: "Token de convite nao fornecido" });
        return;
    }
    try {
        const firestore = (0, firestore_1.getFirestore)();
        const invitationSnap = await firestore
            .collection("tenant_invitations")
            .where("token", "==", token)
            .limit(1)
            .get();
        if (invitationSnap.empty) {
            json(res, 404, { error: "Convite nao encontrado" });
            return;
        }
        const invitation = invitationSnap.docs[0].data();
        if (invitation.accepted_at) {
            json(res, 409, { error: "Este convite ja foi aceito" });
            return;
        }
        if (new Date(invitation.expires_at) < new Date()) {
            json(res, 410, { error: "Este convite expirou" });
            return;
        }
        const tenantSnap = await firestore.collection("tenants").doc(invitation.tenant_id).get();
        const tenantName = tenantSnap.exists ? tenantSnap.data()?.name ?? "Restaurante" : "Restaurante";
        json(res, 200, {
            email: invitation.email,
            tenant_id: invitation.tenant_id,
            tenant_name: tenantName,
            expires_at: invitation.expires_at,
        });
    }
    catch (error) {
        logger.error("tenantInvitationInfo failed", error);
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.acceptTenantInvitation = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) {
        json(res, 400, { error: "Token de convite nao fornecido" });
        return;
    }
    const callerEmail = typeof caller.email === "string" ? caller.email.toLowerCase().trim() : "";
    if (!callerEmail) {
        json(res, 400, { error: "Usuario autenticado sem email valido" });
        return;
    }
    try {
        const firestore = (0, firestore_1.getFirestore)();
        const invitationSnap = await firestore
            .collection("tenant_invitations")
            .where("token", "==", token)
            .limit(1)
            .get();
        if (invitationSnap.empty) {
            json(res, 404, { error: "Convite nao encontrado" });
            return;
        }
        const invitationRef = invitationSnap.docs[0].ref;
        const invitation = invitationSnap.docs[0].data();
        if (invitation.accepted_at) {
            json(res, 409, { error: "Este convite ja foi aceito" });
            return;
        }
        if (new Date(invitation.expires_at) < new Date()) {
            json(res, 410, { error: "Este convite expirou" });
            return;
        }
        if (invitation.email.toLowerCase().trim() !== callerEmail) {
            json(res, 403, { error: "Este convite foi enviado para outro email" });
            return;
        }
        const tenantRef = firestore.collection("tenants").doc(invitation.tenant_id);
        const tenantSnap = await tenantRef.get();
        if (!tenantSnap.exists) {
            json(res, 404, { error: "Tenant nao encontrado" });
            return;
        }
        const now = new Date().toISOString();
        const membershipDoc = {
            tenant_id: invitation.tenant_id,
            user_id: caller.uid,
            is_owner: false,
            created_at: now,
        };
        const roleDoc = {
            tenant_id: invitation.tenant_id,
            user_id: caller.uid,
            role: invitation.role,
            created_at: now,
        };
        const batch = firestore.batch();
        batch.set(tenantRef.collection("tenant_members").doc(caller.uid), membershipDoc, { merge: true });
        batch.set(firestore.collection("tenant_memberships").doc(`${invitation.tenant_id}_${caller.uid}`), membershipDoc, { merge: true });
        batch.set(tenantRef.collection("user_roles").doc(`${caller.uid}_${invitation.role}`), roleDoc, { merge: true });
        batch.update(invitationRef, { accepted_at: now });
        await batch.commit();
        json(res, 200, {
            success: true,
            tenant_id: invitation.tenant_id,
        });
    }
    catch (error) {
        logger.error("acceptTenantInvitation failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.platformAdminCreateAdmin = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requirePlatformAdmin(req, res);
    if (!caller)
        return;
    const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
    const email = rawEmail.toLowerCase().trim();
    if (!email || !email.includes("@")) {
        json(res, 400, { error: "Email invalido" });
        return;
    }
    try {
        const firestore = (0, firestore_1.getFirestore)();
        const existing = await firestore
            .collection("platform_admins")
            .where("email", "==", email)
            .limit(1)
            .get();
        if (!existing.empty) {
            json(res, 409, { error: "Este email ja e um administrador da plataforma" });
            return;
        }
        await firestore.collection("platform_admins").add({
            email,
            user_id: null,
            created_by: caller.uid,
            created_at: new Date().toISOString(),
        });
        json(res, 200, { success: true });
    }
    catch (error) {
        logger.error("platformAdminCreateAdmin failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.platformAdminDeleteAdmin = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requirePlatformAdmin(req, res);
    if (!caller)
        return;
    const adminId = typeof req.body?.adminId === "string" ? req.body.adminId.trim() : "";
    if (!adminId) {
        json(res, 400, { error: "Administrador nao informado" });
        return;
    }
    try {
        const firestore = (0, firestore_1.getFirestore)();
        const adminsSnap = await firestore.collection("platform_admins").get();
        if (adminsSnap.size <= 1) {
            json(res, 400, { error: "Nao e possivel remover o unico administrador" });
            return;
        }
        const adminRef = firestore.collection("platform_admins").doc(adminId);
        const adminSnap = await adminRef.get();
        if (!adminSnap.exists) {
            json(res, 404, { error: "Administrador nao encontrado" });
            return;
        }
        const admin = adminSnap.data();
        const callerEmail = typeof caller.email === "string" ? caller.email.toLowerCase().trim() : "";
        if (admin.user_id === caller.uid || (admin.email?.toLowerCase().trim() ?? "") === callerEmail) {
            json(res, 400, { error: "Voce nao pode remover a si mesmo" });
            return;
        }
        await adminRef.delete();
        json(res, 200, { success: true });
    }
    catch (error) {
        logger.error("platformAdminDeleteAdmin failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.platformAdminUpdateTenantStatus = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requirePlatformAdmin(req, res);
    if (!caller)
        return;
    const tenantId = typeof req.body?.tenantId === "string" ? req.body.tenantId.trim() : "";
    const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : null;
    if (!tenantId || isActive === null) {
        json(res, 400, { error: "tenantId e isActive sao obrigatorios" });
        return;
    }
    try {
        const firestore = (0, firestore_1.getFirestore)();
        const tenantRef = firestore.collection("tenants").doc(tenantId);
        const tenantSnap = await tenantRef.get();
        if (!tenantSnap.exists) {
            json(res, 404, { error: "Tenant nao encontrado" });
            return;
        }
        await tenantRef.update({
            is_active: isActive,
            updated_at: new Date().toISOString(),
        });
        json(res, 200, { success: true });
    }
    catch (error) {
        logger.error("platformAdminUpdateTenantStatus failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.bootstrapTenant = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    const { name, slug } = (req.body ?? {});
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    if (!normalizedName || normalizedName.length < 2) {
        json(res, 400, { error: "Nome do restaurante invalido" });
        return;
    }
    if (!/^[a-z0-9-]{3,50}$/.test(normalizedSlug)) {
        json(res, 400, { error: "Slug invalido" });
        return;
    }
    try {
        const firestore = (0, firestore_1.getFirestore)();
        const slugStatus = await resolveTenantSlugAvailability(firestore, normalizedSlug, caller.uid);
        if (!slugStatus.available) {
            json(res, 409, { error: "Este slug ja esta em uso" });
            return;
        }
        const now = new Date().toISOString();
        const tenantRef = firestore.collection("tenants").doc();
        const tenantId = tenantRef.id;
        const membershipRef = tenantRef.collection("tenant_members").doc(caller.uid);
        const legacyMembershipRef = firestore.collection("tenant_memberships").doc(`${tenantId}_${caller.uid}`);
        const adminRoleRef = tenantRef.collection("user_roles").doc(`${caller.uid}_admin`);
        const kdsSettingsRef = tenantRef.collection("kds_global_settings").doc();
        const defaultStations = [
            { name: "Em preparacao", station_type: "prep_start", color: "#F59E0B", icon: "ChefHat", sort_order: 1, is_active: true },
            { name: "Item em montagem", station_type: "item_assembly", color: "#8B5CF6", icon: "Package", sort_order: 2, is_active: true },
            { name: "Em producao", station_type: "assembly", color: "#3B82F6", icon: "Flame", sort_order: 3, is_active: true },
            { name: "Item em finalizacao", station_type: "oven_expedite", color: "#EF4444", icon: "Timer", sort_order: 4, is_active: true },
            { name: "Status do pedido", station_type: "order_status", color: "#10B981", icon: "ClipboardCheck", sort_order: 5, is_active: true },
        ];
        const batch = firestore.batch();
        batch.set(tenantRef, {
            name: normalizedName,
            slug: normalizedSlug,
            owner_id: caller.uid,
            is_active: true,
            created_at: now,
            updated_at: now,
        });
        batch.set(membershipRef, {
            tenant_id: tenantId,
            user_id: caller.uid,
            is_owner: true,
            created_at: now,
        });
        batch.set(legacyMembershipRef, {
            tenant_id: tenantId,
            user_id: caller.uid,
            is_owner: true,
            created_at: now,
        });
        batch.set(adminRoleRef, {
            tenant_id: tenantId,
            user_id: caller.uid,
            role: "admin",
            created_at: now,
        });
        batch.set(kdsSettingsRef, {
            operation_mode: "traditional",
            compact_mode: false,
            show_pending_column: true,
            show_waiter_name: true,
            show_party_size: true,
            timer_green_minutes: 5,
            timer_yellow_minutes: 10,
            sla_green_minutes: 8,
            sla_yellow_minutes: 12,
            highlight_special_borders: true,
            border_keywords: ["borda", "recheada", "chocolate", "catupiry", "cheddar"],
            border_badge_color: "amber",
            notes_badge_color: "orange",
            notes_blink_all_stations: false,
            delay_alert_enabled: true,
            delay_alert_minutes: 10,
            cancellation_alerts_enabled: true,
            cancellation_alert_interval: 3,
            auto_print_cancellations: true,
            bottleneck_settings: {
                enabled: true,
                defaultMaxQueueSize: 5,
                defaultMaxTimeRatio: 1.5,
                stationOverrides: {},
            },
            tenant_id: tenantId,
        });
        for (const station of defaultStations) {
            batch.set(tenantRef.collection("kds_stations").doc(), {
                ...station,
                description: null,
                created_at: now,
                updated_at: now,
                tenant_id: tenantId,
            });
        }
        for (let index = 0; index < 10; index += 1) {
            batch.set(tenantRef.collection("tables").doc(), {
                number: index + 1,
                capacity: 4,
                status: "available",
                position_x: 0,
                position_y: 0,
                created_at: now,
                tenant_id: tenantId,
            });
        }
        await batch.commit();
        json(res, 200, {
            success: true,
            tenant: {
                id: tenantId,
                name: normalizedName,
                slug: normalizedSlug,
            },
        });
    }
    catch (error) {
        logger.error("bootstrapTenant failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.createUser = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    const { email, password, name, role, tenant_id } = (req.body ?? {});
    if (!email || !password || !name || !role) {
        json(res, 400, { error: "Missing required fields: email, password, name, role" });
        return;
    }
    const validRoles = ["admin", "cashier", "waiter", "kitchen", "kds"];
    if (!validRoles.includes(role)) {
        json(res, 400, { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
        return;
    }
    try {
        const created = await (0, auth_1.getAuth)().createUser({
            email,
            password,
            displayName: name,
            emailVerified: true,
        });
        await (0, auth_1.getAuth)().setCustomUserClaims(created.uid, {
            role,
            tenant_id: tenant_id ?? null,
            created_by: caller.uid,
        });
        json(res, 200, {
            success: true,
            user: { id: created.uid, email, name, role },
        });
    }
    catch (error) {
        logger.error("createUser failed", error);
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.adminUpdateUser = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    const { userId, email, password, name } = (req.body ?? {});
    if (!userId) {
        json(res, 400, { error: "ID do usuario nao fornecido" });
        return;
    }
    const updates = {};
    if (email)
        updates.email = email;
    if (password)
        updates.password = password;
    if (name)
        updates.displayName = name.toUpperCase();
    try {
        await (0, auth_1.getAuth)().updateUser(userId, updates);
        json(res, 200, { success: true, message: "Usuario atualizado com sucesso" });
    }
    catch (error) {
        logger.error("adminUpdateUser failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.adminDeleteUser = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    const { userId } = (req.body ?? {});
    if (!userId) {
        json(res, 400, { error: "ID do usuario nao fornecido" });
        return;
    }
    if (userId === caller.uid) {
        json(res, 400, { error: "Voce nao pode excluir sua propria conta por aqui" });
        return;
    }
    try {
        await (0, auth_1.getAuth)().deleteUser(userId);
        json(res, 200, { success: true, message: "Usuario excluido com sucesso" });
    }
    catch (error) {
        logger.error("adminDeleteUser failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.deleteUser = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    try {
        await (0, auth_1.getAuth)().deleteUser(caller.uid);
        json(res, 200, { success: true, message: "Conta excluida com sucesso" });
    }
    catch (error) {
        logger.error("deleteUser failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.qzSign = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    if (handlePreflight(req, res))
        return;
    const caller = await requireAuth(req, res);
    if (!caller)
        return;
    const body = (req.body ?? {});
    if (!body.data) {
        json(res, 400, { error: "Missing data to sign" });
        return;
    }
    const privateKey = readQzPrivateKey();
    if (!privateKey) {
        json(res, 501, { error: "QZ private key is not configured" });
        return;
    }
    try {
        const signer = (0, node_crypto_1.createSign)("RSA-SHA512");
        signer.update(body.data);
        signer.end();
        const signature = signer.sign(privateKey, "base64");
        json(res, 200, { signature });
    }
    catch (error) {
        logger.error("qzSign failed", { caller: caller.uid, error });
        const message = error instanceof Error ? error.message : "Internal error";
        json(res, 500, { error: message });
    }
});
exports.cardapiowebSyncStatus = proxyToSupabase("cardapioweb-sync-status");
exports.cardapiowebSyncOrders = proxyToSupabase("cardapioweb-sync-orders");
exports.cardapiowebWebhook = proxyToSupabase("cardapioweb-webhook");
exports.replicateMenu = proxyToSupabase("replicate-menu");
exports.sendReopenNotification = proxyToSupabase("send-reopen-notification");
exports.openaiTts = proxyToSupabase("openai-tts");
exports.elevenlabsTts = proxyToSupabase("elevenlabs-tts");
exports.productionApi = proxyToSupabase("production-api");
exports.productionWebhook = proxyToSupabase("production-webhook");
exports.publicStore = proxyToSupabase("public-store");
//# sourceMappingURL=index.js.map