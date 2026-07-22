export const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
export function isForbiddenPathSegment(segment) {
    return segment !== undefined && segment !== null && FORBIDDEN_PATH_SEGMENTS.has(String(segment));
}
export function hasForbiddenPathSegment(segments) {
    return segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(String(segment)));
}
//# sourceMappingURL=path-safety.js.map