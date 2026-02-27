import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, MapPin, Users, Lock, DoorOpen, Plus, Pencil, Trash2, LayoutGrid, Map } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const api = axios.create({ baseURL: '', withCredentials: true });

const EMPTY_FORM = {
    name: '',
    address: '',
    description: '',
    leaderId: '',
    capacity: 12,
    isPrivate: false,
    isOpen: true,
    participantIds: []
};

const displayName = (user) => {
    if (!user) return 'Unbekannt';
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || `@${user.username || ''}`;
};

const userInitials = (user) => {
    const label = displayName(user);
    return label
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
};

const buildMapOpenUrl = (address) => {
    const query = encodeURIComponent(address || '');
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getMapStyleObject = () => {
    // CARTO Positron (key-frei), minimalistischer heller Kartenstil.
    return {
        version: 8,
        sources: {
            basemap: {
                type: 'raster',
                tiles: [
                    'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                    'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            }
        },
        layers: [
            { id: 'basemap', type: 'raster', source: 'basemap' }
        ]
    };
};

const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';

const HouseGroups = ({ currentUser, showToast, showConfirm }) => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [memberSearch, setMemberSearch] = useState('');
    const [busyGroupId, setBusyGroupId] = useState('');
    const [viewMode, setViewMode] = useState('cards');
    const [geoByGroupId, setGeoByGroupId] = useState({});
    const mapCanvasRef = useRef(null);
    const mapRef = useRef(null);
    const mapMarkerRefs = useRef([]);
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
    const [mapError, setMapError] = useState('');

    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.roles?.includes('ADMIN');

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/house-groups');
            setGroups(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            setGroups([]);
            showToast(e.response?.data?.error || 'Hauskreise konnten nicht geladen werden.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        if (!isAdmin) return;
        try {
            const res = await api.get('/api/users');
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch {
            setUsers([]);
        }
    };

    useEffect(() => {
        fetchGroups();
        fetchUsers();
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const update = () => setIsDarkMode(root.classList.contains('dark'));
        update();
        const observer = new MutationObserver(update);
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let cancelled = false;
        const geocodeAll = async () => {
            const nextEntries = {};
            for (const group of groups) {
                if (!group?._id || !group?.address) continue;
                if (geoByGroupId[group._id]) continue;
                const cacheKey = `housegroup_geocode_${group._id}_${group.address}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lon)) {
                            nextEntries[group._id] = { lat: parsed.lat, lon: parsed.lon };
                            continue;
                        }
                    } catch {
                        // ignore corrupted cache
                    }
                }
                try {
                    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(group.address)}`;
                    const res = await fetch(url, { headers: { 'Accept-Language': 'de' } });
                    const data = await res.json();
                    const first = Array.isArray(data) ? data[0] : null;
                    const lat = Number(first?.lat);
                    const lon = Number(first?.lon);
                    if (Number.isFinite(lat) && Number.isFinite(lon)) {
                        const geo = { lat, lon };
                        nextEntries[group._id] = geo;
                        localStorage.setItem(cacheKey, JSON.stringify(geo));
                    }
                } catch {
                    // ignore geocode errors per item
                }
            }
            if (!cancelled && Object.keys(nextEntries).length > 0) {
                setGeoByGroupId((prev) => ({ ...prev, ...nextEntries }));
            }
        };
        geocodeAll();
        return () => {
            cancelled = true;
        };
    }, [groups]);

    const resetForm = () => {
        setEditingId('');
        setForm(EMPTY_FORM);
        setMemberSearch('');
    };

    const openCreate = () => {
        resetForm();
        setDialogOpen(true);
    };

    const openEdit = (group) => {
        setEditingId(group._id);
        setForm({
            name: group.name || '',
            address: group.address || '',
            description: group.description || '',
            leaderId: group.leader?._id || '',
            capacity: Number(group.capacity || 12),
            isPrivate: Boolean(group.isPrivate),
            isOpen: Boolean(group.isOpen),
            participantIds: Array.isArray(group.participants) ? group.participants.map((p) => String(p._id)) : []
        });
        setMemberSearch('');
        setDialogOpen(true);
    };

    const saveGroup = async () => {
        if (!form.name.trim() || !form.address.trim() || !form.leaderId) {
            showToast('Name, Adresse und Leitung sind erforderlich.', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                name: form.name.trim(),
                address: form.address.trim(),
                description: form.description.trim(),
                capacity: Math.max(1, Number(form.capacity || 12)),
                participantIds: [...new Set([...(form.participantIds || []), form.leaderId])]
            };
            if (editingId) {
                await api.put(`/api/house-groups/${editingId}`, payload);
                showToast('Hauskreis aktualisiert.', 'success');
            } else {
                await api.post('/api/house-groups', payload);
                showToast('Hauskreis erstellt.', 'success');
            }
            setDialogOpen(false);
            resetForm();
            await fetchGroups();
        } catch (e) {
            showToast(e.response?.data?.error || 'Speichern fehlgeschlagen.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const deleteGroup = (group) => {
        showConfirm(
            'Hauskreis löschen',
            `Soll "${group.name}" wirklich gelöscht werden?`,
            async () => {
                try {
                    await api.delete(`/api/house-groups/${group._id}`);
                    showToast('Hauskreis gelöscht.', 'success');
                    await fetchGroups();
                } catch (e) {
                    showToast(e.response?.data?.error || 'Löschen fehlgeschlagen.', 'error');
                }
            }
        );
    };

    const toggleJoin = async (group, join = true) => {
        setBusyGroupId(group._id);
        try {
            await api.post(`/api/house-groups/${group._id}/${join ? 'join' : 'leave'}`);
            showToast(join ? 'Du nimmst jetzt teil.' : 'Du bist ausgetragen.', 'success');
            await fetchGroups();
        } catch (e) {
            showToast(e.response?.data?.error || 'Aktion fehlgeschlagen.', 'error');
        } finally {
            setBusyGroupId('');
        }
    };

    const filteredUsers = useMemo(() => {
        const query = memberSearch.trim().toLowerCase();
        if (!query) return users;
        return users.filter((user) => {
            const label = `${user.firstName || ''} ${user.lastName || ''} ${user.username || ''}`.toLowerCase();
            return label.includes(query);
        });
    }, [users, memberSearch]);

    const groupedWithGeo = useMemo(() => {
        return groups
            .map((group) => {
                const geo = geoByGroupId[group._id];
                return {
                    ...group,
                    lat: geo?.lat,
                    lon: geo?.lon
                };
            });
    }, [groups, geoByGroupId]);

    const singleMapMeta = useMemo(() => {
        const points = groupedWithGeo.filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lon));
        if (points.length === 0) return null;
        const latitudes = points.map((p) => p.lat);
        const longitudes = points.map((p) => p.lon);
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLon = Math.min(...longitudes);
        const maxLon = Math.max(...longitudes);
        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        const spread = Math.max(maxLat - minLat, maxLon - minLon);
        const zoom = spread > 2 ? 7 : spread > 1 ? 8 : spread > 0.5 ? 9 : spread > 0.2 ? 10 : spread > 0.08 ? 11 : 12;
        const padLat = Math.max((maxLat - minLat) * 0.25, 0.02);
        const padLon = Math.max((maxLon - minLon) * 0.25, 0.02);
        const bbox = {
            minLon: clamp(minLon - padLon, -180, 180),
            minLat: clamp(minLat - padLat, -85, 85),
            maxLon: clamp(maxLon + padLon, -180, 180),
            maxLat: clamp(maxLat + padLat, -85, 85)
        };
        return { centerLat, centerLon, zoom: clamp(zoom, 3, 16), pointsCount: points.length, bbox };
    }, [groupedWithGeo]);

    const mapMarkers = useMemo(() => {
        return groupedWithGeo
            .filter((group) => Number.isFinite(group.lat) && Number.isFinite(group.lon))
            .map((group, idx) => ({
                id: group._id,
                label: idx + 1,
                name: group.name,
                lat: group.lat,
                lon: group.lon
            }));
    }, [groupedWithGeo]);

    useEffect(() => {
        if (viewMode !== 'map' || !mapCanvasRef.current) return;

        const styleObject = getMapStyleObject();
        const defaultCenter = [9.18, 49.14];
        if (!mapRef.current) {
            mapRef.current = new maplibregl.Map({
                container: mapCanvasRef.current,
                style: styleObject,
                center: singleMapMeta ? [singleMapMeta.centerLon, singleMapMeta.centerLat] : defaultCenter,
                zoom: singleMapMeta ? singleMapMeta.zoom : 7,
                attributionControl: true
            });
            mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
            mapRef.current.on('error', () => {
                setMapError('Kartenstil konnte nicht geladen werden. Fallback aktiv.');
            });
        } else {
            mapRef.current.setStyle(styleObject);
            mapRef.current.resize();
        }

        const map = mapRef.current;
        const applyData = () => {
            setMapError('');
            mapMarkerRefs.current.forEach((marker) => marker.remove());
            mapMarkerRefs.current = [];
            if (!singleMapMeta || mapMarkers.length === 0) return;
            mapMarkers.forEach((marker) => {
                const el = document.createElement('div');
                el.className = 'h-7 min-w-7 px-1.5 rounded-full bg-background/95 text-foreground text-[10px] font-semibold flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.24)] ring-1 ring-border/70';
                el.textContent = String(marker.label);
                const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                    .setLngLat([marker.lon, marker.lat])
                    .addTo(map);
                mapMarkerRefs.current.push(m);
            });

            const bounds = new maplibregl.LngLatBounds();
            mapMarkers.forEach((m) => bounds.extend([m.lon, m.lat]));
            if (mapMarkers.length === 1) {
                map.flyTo({ center: [mapMarkers[0].lon, mapMarkers[0].lat], zoom: 12, essential: true });
            } else if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 });
            }
        };

        const onStyleErrorFallback = () => {
            try {
                map.setStyle(FALLBACK_STYLE);
            } catch {
                // ignore
            }
        };

        map.once('styledata', applyData);
        map.once('error', onStyleErrorFallback);
        return () => {
            map.off('styledata', applyData);
            map.off('error', onStyleErrorFallback);
        };
    }, [viewMode, singleMapMeta, isDarkMode, mapMarkers]);

    useEffect(() => {
        return () => {
            mapMarkerRefs.current.forEach((marker) => marker.remove());
            mapMarkerRefs.current = [];
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    const toggleParticipant = (userId) => {
        setForm((prev) => {
            const has = (prev.participantIds || []).includes(userId);
            if (has && userId === prev.leaderId) return prev;
            return {
                ...prev,
                participantIds: has
                    ? prev.participantIds.filter((id) => id !== userId)
                    : [...(prev.participantIds || []), userId]
            };
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            <Card className="border-primary/10">
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="text-2xl tracking-tight">Hauskreise</CardTitle>
                            <CardDescription>
                                Übersicht aller Hauskreise mit Leitung, Adresse, Teilnehmern und Status.
                            </CardDescription>
                        </div>
                        {isAdmin && (
                            <Button className="gap-2" onClick={openCreate}>
                                <Plus size={16} /> Neuer Hauskreis
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <Button
                            size="sm"
                            variant={viewMode === 'cards' ? 'default' : 'outline'}
                            className="gap-1.5"
                            onClick={() => setViewMode('cards')}
                        >
                            <LayoutGrid size={14} /> Übersicht
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'map' ? 'default' : 'outline'}
                            className="gap-1.5"
                            onClick={() => setViewMode('map')}
                        >
                            <Map size={14} /> Landkarte
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {loading && (
                <div className="flex items-center justify-center py-14 text-muted-foreground">
                    <Loader2 className="animate-spin mr-2" size={16} /> Lädt Hauskreise...
                </div>
            )}

            {!loading && groups.length === 0 && (
                <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        Noch keine Hauskreise vorhanden.
                    </CardContent>
                </Card>
            )}

            {!loading && groups.length > 0 && viewMode === 'cards' && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {groups.map((group) => (
                        <Card key={group._id} className="border-primary/10">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <CardTitle className="text-lg truncate">{group.name}</CardTitle>
                                        <div className="mt-1 text-xs text-muted-foreground flex items-start gap-1.5">
                                            <MapPin size={12} className="mt-0.5 shrink-0" />
                                            <span className="line-clamp-2">{group.address}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {group.isPrivate ? (
                                            <Badge variant="secondary" className="gap-1"><Lock size={10} /> Privat</Badge>
                                        ) : (
                                            <Badge variant="outline" className="gap-1"><DoorOpen size={10} /> Offen</Badge>
                                        )}
                                        {group.isFull && <Badge variant="destructive">Voll</Badge>}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Leitung:</span>{' '}
                                    <span className="font-semibold">{displayName(group.leader)}</span>
                                </div>

                                {group.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                                )}

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                        <Users size={12} /> Teilnehmer
                                    </span>
                                    <span>{group.participantsCount}/{group.capacity}</span>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {(group.participants || []).slice(0, 7).map((participant) => (
                                        <Badge key={participant._id} variant="outline" className="h-7 pl-1.5 pr-2 gap-1.5">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={participant.profileImage || ''} />
                                                <AvatarFallback className="text-[9px]">{userInitials(participant)}</AvatarFallback>
                                            </Avatar>
                                            <span className="max-w-[110px] truncate">{displayName(participant)}</span>
                                        </Badge>
                                    ))}
                                    {(group.participants || []).length > 7 && (
                                        <Badge variant="secondary">+{(group.participants || []).length - 7}</Badge>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                    {!group.isParticipant && !group.isPrivate && group.isOpen && !group.isFull && (
                                        <Button
                                            size="sm"
                                            onClick={() => toggleJoin(group, true)}
                                            disabled={busyGroupId === group._id}
                                        >
                                            {busyGroupId === group._id ? <Loader2 className="animate-spin" size={14} /> : 'Teilnehmen'}
                                        </Button>
                                    )}
                                    {group.isParticipant && !group.isLeader && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => toggleJoin(group, false)}
                                            disabled={busyGroupId === group._id}
                                        >
                                            {busyGroupId === group._id ? <Loader2 className="animate-spin" size={14} /> : 'Austragen'}
                                        </Button>
                                    )}
                                    {isAdmin && (
                                        <>
                                            <Button size="sm" variant="outline" onClick={() => openEdit(group)} className="gap-1.5">
                                                <Pencil size={13} /> Bearbeiten
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => deleteGroup(group)} className="gap-1.5">
                                                <Trash2 size={13} /> Löschen
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {!loading && groups.length > 0 && viewMode === 'map' && (
                <div className="space-y-5">
                    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-background shadow-xl">
                        <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="text-xl tracking-tight">Hauskreise Landkarte</CardTitle>
                                    <CardDescription className="mt-1">
                                        {singleMapMeta
                                            ? `${singleMapMeta.pointsCount} von ${groups.length} Hauskreisen sind auf der Karte sichtbar.`
                                            : 'Adressen werden gerade geokodiert...'}
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="h-7 px-2.5 rounded-full border-primary/30 bg-background/70 backdrop-blur">
                                        <MapPin size={11} className="mr-1.5" /> {mapMarkers.length} Marker
                                    </Badge>
                                    <Badge variant="outline" className="h-7 px-2.5 rounded-full border-primary/30 bg-background/70 backdrop-blur">
                                        <Users size={11} className="mr-1.5" /> {groups.reduce((sum, g) => sum + Number(g.participantsCount || 0), 0)} Teilnehmer
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {singleMapMeta ? (
                                <div ref={mapCanvasRef} className="relative h-[460px] rounded-2xl border border-primary/20 overflow-hidden bg-muted/20 shadow-inner">
                                    {mapError && (
                                        <div className="pointer-events-none absolute left-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-medium bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700 z-10">
                                            {mapError}
                                        </div>
                                    )}
                                    <div className="pointer-events-none absolute right-3 bottom-3 rounded-full px-3 py-1.5 text-[11px] font-medium bg-background/80 border border-border/70 shadow-sm backdrop-blur">
                                        OSM/CARTO + MapLibre
                                    </div>
                                    <a
                                        href="https://www.openstreetmap.org/copyright"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="absolute left-3 bottom-3 text-[10px] px-2 py-1 rounded bg-background/80 border border-border/70 backdrop-blur text-muted-foreground hover:text-foreground"
                                    >
                                        © OpenStreetMap
                                    </a>
                                </div>
                            ) : (
                                <div className="h-56 rounded-2xl border border-primary/20 bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
                                    <Loader2 className="animate-spin mr-2" size={16} /> Karte wird vorbereitet...
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {groupedWithGeo.map((group) => (
                            <Card key={`map-list-${group._id}`} className="group relative overflow-hidden border-primary/15 bg-card/95 shadow-sm hover:shadow-md transition-all">
                                <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-primary/70 to-primary/20" />
                                <CardContent className="pt-4 pl-5 space-y-2.5">
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="min-w-0">
                                            <p className="font-semibold truncate text-[15px]">{group.name}</p>
                                            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{group.address}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {group.isPrivate ? (
                                                <Badge variant="secondary" className="gap-1"><Lock size={10} /> Privat</Badge>
                                            ) : (
                                                <Badge variant="outline" className="gap-1"><DoorOpen size={10} /> Offen</Badge>
                                            )}
                                            {group.isFull && <Badge variant="destructive">Voll</Badge>}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                                        <span>{group.participantsCount}/{group.capacity} Teilnehmer</span>
                                        <span>{Number.isFinite(group.lat) && Number.isFinite(group.lon) ? 'Marker aktiv' : 'Adresse wird geprüft'}</span>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-full"
                                            onClick={() => window.open(buildMapOpenUrl(group.address), '_blank', 'noopener,noreferrer')}
                                        >
                                            Route ansehen
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Hauskreis bearbeiten' : 'Hauskreis anlegen'}</DialogTitle>
                        <DialogDescription>
                            Verwalte Name, Adresse, Leitung, Teilnehmer und Sichtbarkeit des Hauskreises.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Name</Label>
                                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Adresse</Label>
                                <Input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Leitung</Label>
                                <Select
                                    value={form.leaderId || '__none'}
                                    onValueChange={(value) => {
                                        const nextLeaderId = value === '__none' ? '' : value;
                                        setForm((prev) => ({
                                            ...prev,
                                            leaderId: nextLeaderId,
                                            participantIds: nextLeaderId
                                                ? [...new Set([...(prev.participantIds || []), nextLeaderId])]
                                                : prev.participantIds
                                        }));
                                    }}
                                >
                                    <SelectTrigger><SelectValue placeholder="Leitung wählen" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none">Leitung wählen</SelectItem>
                                        {users.map((user) => (
                                            <SelectItem key={user._id} value={user._id}>{displayName(user)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Kapazität</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={form.capacity}
                                    onChange={(e) => setForm((prev) => ({ ...prev, capacity: Number(e.target.value || 1) }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Beschreibung</Label>
                            <Textarea
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium">Privater Hauskreis</p>
                                    <p className="text-xs text-muted-foreground">Nur durch Leitung/Admin verwaltbar</p>
                                </div>
                                <Switch checked={form.isPrivate} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isPrivate: checked }))} />
                            </div>
                            <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium">Offen für Beitritt</p>
                                    <p className="text-xs text-muted-foreground">Selbstständiger Beitritt erlaubt</p>
                                </div>
                                <Switch checked={form.isOpen} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isOpen: checked }))} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Teilnehmer</Label>
                            <Input
                                placeholder="Mitglied suchen..."
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                            />
                            <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                                {filteredUsers.map((user) => {
                                    const checked = (form.participantIds || []).includes(String(user._id));
                                    const isLeader = String(form.leaderId || '') === String(user._id);
                                    return (
                                        <label key={user._id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer">
                                            <span className="text-sm truncate">{displayName(user)}</span>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={isLeader}
                                                onChange={() => toggleParticipant(String(user._id))}
                                            />
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
                            <Button onClick={saveGroup} disabled={saving}>
                                {saving ? <Loader2 className="animate-spin" size={15} /> : (editingId ? 'Speichern' : 'Anlegen')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default HouseGroups;
