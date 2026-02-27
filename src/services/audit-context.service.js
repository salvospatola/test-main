import { AsyncLocalStorage } from 'async_hooks';

const auditStorage = new AsyncLocalStorage();

export const runWithAuditContext = (context, fn) => {
    return auditStorage.run(context || {}, fn);
};

export const getAuditContext = () => {
    return auditStorage.getStore() || {};
};

export const getAuditUserId = () => {
    const ctx = getAuditContext();
    return ctx?.userId ? String(ctx.userId) : '';
};

