import * as LucideIcons from 'lucide-react';

const toLabel = (name) =>
    String(name || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();

const ICON_COMPONENTS = Object.fromEntries(
    Object.entries(LucideIcons).filter(([name, component]) => (
        typeof component === 'function'
        && /^[A-Z]/.test(name)
        && !name.endsWith('Icon')
        && name !== 'createLucideIcon'
    ))
);

export const TEAM_ICON_OPTIONS = Object.keys(ICON_COMPONENTS)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((name) => ({ value: name, label: toLabel(name) }));

export const getTeamIcon = (iconName) => ICON_COMPONENTS[iconName] || LucideIcons.Tag;
