"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORBIDDEN_PATH_SEGMENTS = void 0;
exports.isForbiddenPathSegment = isForbiddenPathSegment;
exports.hasForbiddenPathSegment = hasForbiddenPathSegment;
exports.FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
function isForbiddenPathSegment(segment) {
    return segment !== undefined && segment !== null && exports.FORBIDDEN_PATH_SEGMENTS.has(String(segment));
}
function hasForbiddenPathSegment(segments) {
    return segments.some((segment) => exports.FORBIDDEN_PATH_SEGMENTS.has(String(segment)));
}
//# sourceMappingURL=path-safety.js.map