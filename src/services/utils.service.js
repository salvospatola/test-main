/**
 * Normalisiert eine Telefonnummer auf das E.164-ähnliche Format ohne '+' (z.B. 491701234567)
 * @param {string|number} phone 
 * @returns {string}
 */
export const normalizePhone = (phone) => {
    if (!phone) return '';
    
    let cleaned = String(phone).replace(/\D/g, '');
    
    // 00... -> ... (z.B. 0049 -> 49)
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }
    
    // 0... (aber nicht 00...) -> 49... (z.B. 0170 -> 49170)
    if (cleaned.startsWith('0')) {
        cleaned = '49' + cleaned.substring(1);
    }
    
    return cleaned;
};
