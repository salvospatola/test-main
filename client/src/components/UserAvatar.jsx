import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const getInitials = (user) => {
    if (!user) return '?';
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    return (user.username || '?')[0].toUpperCase();
};

const getFallbackToneClass = (user) => {
    const seedChar = (user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase();
    const code = seedChar.charCodeAt(0);
    const alphabetIndex = code >= 65 && code <= 90 ? code - 65 : code;
    const palette = [
        "bg-[rgb(161,206,217)] text-[#1f2a37]", // pastel blue
        "bg-[rgb(210,186,224)] text-[#3f3350]", // pastel lilac
        "bg-[rgb(237,132,91)]/80 text-[#5f2f1e]", // pastel orange
        "bg-[rgb(173,235,179)] text-[#1f4a2d]" // pastel green
    ];
    return palette[Math.abs(alphabetIndex) % palette.length];
};

export const UserAvatar = ({ user, size = 'md', className = '', showStatus = false, statusPosition = 'right', onClick }) => {
    const initials = getInitials(user);
    const fallbackToneClass = getFallbackToneClass(user);
    
    const sizeClasses = {
        xs: 'h-6 w-6 text-[8px]',
        sm: 'h-8 w-8 text-[10px]',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
        xl: 'h-20 w-20 text-2xl'
    };

    const statusSizeClasses = {
        xs: 'h-2 w-2',
        sm: 'h-2.5 w-2.5',
        md: 'h-3 w-3',
        lg: 'h-3.5 w-3.5',
        xl: 'h-5 w-5'
    };

    // Determine rounding: use provided class or default to rounded-full
    const isCustomRounded = className.includes('rounded-');
    const roundingClass = isCustomRounded ? '' : 'rounded-full';

    return (
        <div 
            className={cn(
                "relative inline-flex shrink-0 items-center justify-center", 
                sizeClasses[size] || sizeClasses.md,
                roundingClass,
                className
            )}
            onClick={onClick}
        >
            <Avatar className={cn("h-full w-full", roundingClass, className)}>
                <AvatarImage 
                    src={user?.optimizedProfileImage || user?.profileImage} 
                    alt={user?.firstName || user?.username} 
                    className="object-cover aspect-square" 
                />
                <AvatarFallback className={cn("font-semibold flex items-center justify-center w-full h-full", fallbackToneClass)}>
                    {initials}
                </AvatarFallback>
            </Avatar>
            {showStatus && (
                <span className={cn(
                    "absolute bottom-0 block rounded-full border-2 border-background z-10",
                    statusPosition === 'left' ? "left-0" : "right-0",
                    user?.isOnline ? "bg-emerald-500" : "bg-muted-foreground/30",
                    statusSizeClasses[size] || statusSizeClasses.md
                )} />
            )}
        </div>
    );
};
