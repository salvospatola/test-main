import { User } from './db.service.js';

/**
 * Finds a user by various name formats (Full Name, First Name, Username)
 * @param {string} name 
 * @returns {Promise<User|null>}
 */
export const findUserByName = async (name) => {
    if (!name || name === '/' || name === '?' || name === '-') return null;
    
    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/);
    
    if (parts.length >= 2) {
        // Try exact match on first and last name
        const user = await User.findOne({ 
            firstName: { $regex: new RegExp(`^${parts[0]}$`, 'i') }, 
            lastName: { $regex: new RegExp(`^${parts[parts.length-1]}$`, 'i') } 
        });
        if (user) return user;
    }
    
    // Try match on first name OR username
    return await User.findOne({ 
        $or: [
            { firstName: { $regex: new RegExp(`^${cleanName}$`, 'i') } },
            { username: { $regex: new RegExp(`^${cleanName}$`, 'i') } }
        ]
    });
};
