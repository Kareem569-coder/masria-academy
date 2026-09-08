export function getErrorMessage(error, fallback) {
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const message = error.message;
        if (typeof message === 'string' && message)
            return message;
    }
    return fallback;
}
export function getErrorCode(error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = error.code;
        return typeof code === 'string' ? code : undefined;
    }
    return undefined;
}
//# sourceMappingURL=models.js.map