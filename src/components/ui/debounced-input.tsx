import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onSave: (value: string) => void;
  debounceMs?: number;
}

export const DebouncedInput = memo(function DebouncedInput({
  value,
  onSave,
  debounceMs = 500,
  ...props
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedValueRef = useRef(value);

  // Sync with external value only when it changes from outside
  useEffect(() => {
    if (value !== savedValueRef.current) {
      setLocalValue(value);
      savedValueRef.current = value;
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule new save
    timeoutRef.current = setTimeout(() => {
      savedValueRef.current = newValue;
      onSave(newValue);
    }, debounceMs);
  }, [debounceMs, onSave]);

  const handleBlur = useCallback(() => {
    // Save immediately on blur if value changed
    if (localValue !== savedValueRef.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      savedValueRef.current = localValue;
      onSave(localValue);
    }
  }, [localValue, onSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Input
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );
});

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onSave: (value: string) => void;
  debounceMs?: number;
}

export const DebouncedTextarea = memo(function DebouncedTextarea({
  value,
  onSave,
  debounceMs = 500,
  ...props
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedValueRef = useRef(value);

  // Sync with external value only when it changes from outside
  useEffect(() => {
    if (value !== savedValueRef.current) {
      setLocalValue(value);
      savedValueRef.current = value;
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule new save
    timeoutRef.current = setTimeout(() => {
      savedValueRef.current = newValue;
      onSave(newValue);
    }, debounceMs);
  }, [debounceMs, onSave]);

  const handleBlur = useCallback(() => {
    // Save immediately on blur if value changed
    if (localValue !== savedValueRef.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      savedValueRef.current = localValue;
      onSave(localValue);
    }
  }, [localValue, onSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );
});
