import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Trash2, Plus, Shield, Save, Loader2, Search, Filter, Sparkles } from 'lucide-react';
import { formatRoleLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const api = axios.create({ baseURL: '', withCredentials: true });

const normalize = (value) => String(value || '').trim().toLowerCase();

const RoleManagement = ({ showToast, showConfirm, showPrompt }) => {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingRoleId, setSavingRoleId] = useState('');
    const [permissionCatalog, setPermissionCatalog] = useState([]);
    const [search, setSearch] = useState('');
    const [showOnlyActive, setShowOnlyActive] = useState(false);

    const fetchData = async () => {
        try {
            const [r, pc] = await Promise.all([
                api.get('/api/roles').catch(() => ({ data: [] })),
                api.get('/api/permissions/catalog').catch(() => ({ data: [] }))
            ]);
            setRoles(Array.isArray(r.data) ? r.data : []);
            setPermissionCatalog(Array.isArray(pc.data) ? pc.data : []);
        } catch (e) {
            console.error("Fehler beim Laden der Rollen:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const catalogGroups = useMemo(() => {
        const groups = new Map();
        for (const entry of permissionCatalog) {
            const group = String(entry.group || 'Sonstiges').trim();
            if (!groups.has(group)) groups.set(group, []);
            groups.get(group).push(entry);
        }
        return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
    }, [permissionCatalog]);

    const togglePermissionKey = (roleId, permissionKey) => {
        const roleIdStr = String(roleId);
        setRoles((prev) => prev.map((role) => {
            if (String(role._id) !== roleIdStr) return role;
            const current = Array.isArray(role.permissionKeys) ? role.permissionKeys : [];
            const exists = current.includes(permissionKey);
            return {
                ...role,
                permissionKeys: exists ? current.filter((key) => key !== permissionKey) : [...current, permissionKey]
            };
        }));
    };

    const setRolePermissions = (roleId, nextKeys) => {
        const roleIdStr = String(roleId);
        const normalized = Array.from(new Set((Array.isArray(nextKeys) ? nextKeys : []).map((key) => String(key || '').trim()).filter(Boolean)));
        setRoles((prev) => prev.map((role) => (
            String(role._id) === roleIdStr ? { ...role, permissionKeys: normalized } : role
        )));
    };

    const handleSaveRole = async (roleId) => {
        const role = roles.find((entry) => String(entry._id) === String(roleId));
        if (!role) return;
        setSavingRoleId(String(roleId));
        try {
            await api.put(`/api/roles/${roleId}`, {
                permissionKeys: role.permissionKeys || []
            });
            await fetchData();
            showToast?.("Rolle gespeichert", "success");
        } catch (e) {
            showToast?.(e.response?.data?.error || "Fehler beim Speichern", "error");
        } finally {
            setSavingRoleId('');
        }
    };

    const handleAddRole = () => {
        showPrompt("Neue Rolle", "Rollenname eingeben", "Rollen-Name", "", async (name) => {
            const normalizedName = String(name || '').trim().toUpperCase();
            if (!normalizedName) return;
            try {
                await api.post('/api/roles', { name: normalizedName, permissionKeys: [] });
                await fetchData();
                showToast?.(`Rolle "${formatRoleLabel(normalizedName)}" erstellt`, "success");
            } catch (_e) {
                showToast?.("Rolle konnte nicht erstellt werden", "error");
            }
        });
    };

    const handleDeleteRole = (id, name) => {
        showConfirm("Rolle löschen", `Soll die Rolle "${formatRoleLabel(name)}" gelöscht werden?`, async () => {
            try {
                await api.delete(`/api/roles/${id}`);
                await fetchData();
                showToast?.("Rolle gelöscht", "success");
            } catch (_e) {
                showToast?.("Fehler beim Löschen", "error");
            }
        });
    };

    const filterPermissions = (permissions, rolePermissionKeys) => {
        const roleKeys = new Set(Array.isArray(rolePermissionKeys) ? rolePermissionKeys : []);
        return permissions.filter((perm) => {
            const query = normalize(search);
            const matchesQuery = !query
                || normalize(perm.label).includes(query)
                || normalize(perm.description).includes(query)
                || normalize(perm.key).includes(query)
                || normalize(perm.group).includes(query);
            if (!matchesQuery) return false;
            if (!showOnlyActive) return true;
            return roleKeys.has(perm.key);
        });
    };

    if (loading) {
        return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
    }

    return (
        <TooltipProvider>
            <div className="space-y-6 page-transition">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-primary">Rollen & Berechtigungen</h2>
                        <p className="text-muted-foreground text-sm">
                            Einfaches Rechtesystem mit Klartext-Beschreibungen. Jede Berechtigung zeigt transparent, was sie auslöst.
                        </p>
                    </div>
                    <Button onClick={handleAddRole} className="gap-2">
                        <Plus size={16} /> Neue Rolle
                    </Button>
                </div>

                <Card className="border-primary/15">
                    <CardContent className="pt-5 flex flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Permission suchen (Name, Beschreibung, Schlüssel)"
                                className="pl-9"
                            />
                        </div>
                        <Button
                            type="button"
                            variant={showOnlyActive ? "default" : "outline"}
                            className="gap-2"
                            onClick={() => setShowOnlyActive((prev) => !prev)}
                        >
                            <Filter size={14} />
                            {showOnlyActive ? 'Nur aktive' : 'Alle anzeigen'}
                        </Button>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-6">
                    {roles.map((role) => {
                        const roleKeys = new Set(Array.isArray(role.permissionKeys) ? role.permissionKeys : []);
                        const activeCount = roleKeys.size;
                        const totalCount = permissionCatalog.length;

                        return (
                            <Card key={role._id} className="shadow-lg border-primary/10 overflow-hidden">
                                <CardHeader className="border-b bg-muted/20">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <CardTitle className="text-xl">{formatRoleLabel(role.name)}</CardTitle>
                                                <CardDescription>{activeCount} von {totalCount} Berechtigungen aktiv</CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="gap-1">
                                                <Sparkles size={12} /> {Math.round((activeCount / Math.max(totalCount, 1)) * 100)}%
                                            </Badge>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRole(role._id, role.name)}>
                                                <Trash2 size={16} />
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="gap-2"
                                                disabled={savingRoleId === String(role._id)}
                                                onClick={() => handleSaveRole(role._id)}
                                            >
                                                {savingRoleId === String(role._id) ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                Speichern
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-5 pt-5">
                                    {catalogGroups.map((groupEntry) => {
                                        const visiblePermissions = filterPermissions(groupEntry.items, role.permissionKeys);
                                        if (visiblePermissions.length === 0) return null;

                                        return (
                                            <div key={`${role._id}-${groupEntry.group}`} className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                        {groupEntry.group}
                                                    </p>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[10px] uppercase"
                                                            onClick={() => {
                                                                const merged = new Set(role.permissionKeys || []);
                                                                for (const entry of groupEntry.items) merged.add(entry.key);
                                                                setRolePermissions(role._id, Array.from(merged));
                                                            }}
                                                        >
                                                            Alle setzen
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-[10px] uppercase"
                                                            onClick={() => {
                                                                const removeSet = new Set(groupEntry.items.map((entry) => entry.key));
                                                                const next = (role.permissionKeys || []).filter((key) => !removeSet.has(key));
                                                                setRolePermissions(role._id, next);
                                                            }}
                                                        >
                                                            Gruppe leeren
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {visiblePermissions.map((perm) => {
                                                        const active = roleKeys.has(perm.key);
                                                        return (
                                                            <Tooltip key={`${role._id}-${perm.key}`}>
                                                                <TooltipTrigger asChild>
                                                                    <Badge
                                                                        variant={active ? "default" : "outline"}
                                                                        className="cursor-pointer"
                                                                        onClick={() => togglePermissionKey(role._id, perm.key)}
                                                                    >
                                                                        {perm.label}
                                                                    </Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-[340px] text-left space-y-1">
                                                                    <p className="text-xs font-semibold">{perm.label}</p>
                                                                    <p className="text-xs text-muted-foreground">{perm.description || 'Keine Beschreibung vorhanden.'}</p>
                                                                    <p className="text-[10px] font-mono text-muted-foreground/80">{perm.key}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </TooltipProvider>
    );
};

export default RoleManagement;

