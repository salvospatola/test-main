import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Tag, Plus, Trash2, Loader2, Search, Edit2
} from 'lucide-react';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxList,
    ComboboxItem,
} from "@/components/ui/combobox";
import { toast } from "sonner"

const api = axios.create({ baseURL: '', withCredentials: true });

const TagManagement = () => {
    const [tags, setTags] = useState([]);
    const [newTag, setNewTag] = useState('');
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [renameDialog, setRenameDialog] = useState({ open: false, from: '', to: '' });
    const [deleteDialog, setDeleteDialog] = useState({
        open: false,
        name: '',
        mode: 'remove',
        replaceType: 'existing',
        replaceWith: '',
        newName: ''
    });

    const fetchTags = async () => {
        try {
            const res = await api.get('/api/admin/tags');
            setTags(res.data);
        } catch (e) {
            toast.error("Kategorien konnten nicht geladen werden.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTags();
    }, []);

    const handleAddTag = async (e) => {
        e.preventDefault();
        if (!newTag.trim()) return;
        try {
            await api.post('/api/admin/tags', { name: newTag.trim() });
            setNewTag('');
            fetchTags();
            toast.success("Kategorie hinzugefügt");
        } catch (e) {
            toast.error("Fehler beim Hinzufügen");
        }
    };

    const handleDeleteTag = async (name) => {
        const fallbackTarget = tags.find((t) => t.name !== name)?.name || '';
        setDeleteDialog({
            open: true,
            name,
            mode: 'remove',
            replaceType: 'existing',
            replaceWith: fallbackTarget,
            newName: ''
        });
    };

    const handleRenameTag = async () => {
        const fromName = String(renameDialog.from || '').trim();
        const toName = String(renameDialog.to || '').trim();
        if (!toName) {
            toast.error("Neuer Kategorie-Name fehlt.");
            return;
        }
        if (fromName === toName) {
            setRenameDialog({ open: false, from: '', to: '' });
            return;
        }
        try {
            await api.put(`/api/admin/tags/${encodeURIComponent(fromName)}`, { newName: toName });
            setRenameDialog({ open: false, from: '', to: '' });
            fetchTags();
            toast.success("Kategorie umbenannt");
        } catch (e) {
            toast.error(e.response?.data?.error || "Fehler beim Umbenennen");
        }
    };

    const confirmDeleteDialog = async () => {
        const currentName = String(deleteDialog.name || '').trim();
        if (!currentName) return;
        let replaceWith = '';
        if (deleteDialog.mode === 'remap') {
            replaceWith = deleteDialog.replaceType === 'new'
                ? String(deleteDialog.newName || '').trim()
                : String(deleteDialog.replaceWith || '').trim();
            if (!replaceWith) {
                toast.error("Bitte Ziel-Kategorie für die Umlenkung wählen.");
                return;
            }
            if (replaceWith === currentName) {
                toast.error("Ziel-Kategorie muss sich von der zu löschenden Kategorie unterscheiden.");
                return;
            }
        }
        try {
            await api.delete(`/api/admin/tags/${encodeURIComponent(currentName)}`, { data: { replaceWith } });
            setDeleteDialog({
                open: false,
                name: '',
                mode: 'remove',
                replaceType: 'existing',
                replaceWith: '',
                newName: ''
            });
            fetchTags();
            toast.success(deleteDialog.mode === 'remap' ? "Kategorie umgelenkt und gelöscht" : "Kategorie gelöscht");
        } catch (e) {
            toast.error(e.response?.data?.error || "Fehler beim Löschen");
        }
    };

    const filteredTags = tags.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
    const renameTargets = tags.filter((t) => t.name !== deleteDialog.name);

    if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Tag className="text-primary" /> Globale Kategorien
                    </CardTitle>
                    <CardDescription>Systemweite Kategorien verwalten. Das Löschen einer Kategorie entzieht diese allen Benutzern.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleAddTag} className="flex gap-2">
                        <Input 
                            placeholder="Neue Kategorie..." 
                            value={newTag} 
                            onChange={e => setNewTag(e.target.value)}
                            className="max-w-sm"
                        />
                        <Button type="submit">
                            <Plus size={16} className="mr-2" /> Hinzufügen
                        </Button>
                    </form>

                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Kategorien durchsuchen..." 
                            value={filter} 
                            onChange={e => setFilter(e.target.value)} 
                            className="pl-9"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {filteredTags.map(tag => (
                            <div key={tag._id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group">
                                <span className="font-semibold text-sm">{tag.name}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setRenameDialog({ open: true, from: tag.name, to: tag.name })}
                                    >
                                        <Edit2 size={14} />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-destructive"
                                        onClick={() => handleDeleteTag(tag.name)}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {filteredTags.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg">
                                Keine Kategorien gefunden.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={renameDialog.open} onOpenChange={(open) => setRenameDialog((prev) => ({ ...prev, open }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kategorie umbenennen</DialogTitle>
                        <DialogDescription>
                            Alle Referenzen in Benutzer- und Dienstplan-Kategorien werden auf den neuen Namen umgestellt.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Input value={renameDialog.to} onChange={(e) => setRenameDialog((prev) => ({ ...prev, to: e.target.value }))} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameDialog({ open: false, from: '', to: '' })}>Abbrechen</Button>
                        <Button onClick={handleRenameTag}>Speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kategorie löschen</DialogTitle>
                        <DialogDescription>
                            Du kannst die Kategorie entfernen oder alle Referenzen auf eine andere Kategorie umlenken.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant={deleteDialog.mode === 'remove' ? 'default' : 'outline'}
                                onClick={() => setDeleteDialog((prev) => ({ ...prev, mode: 'remove' }))}
                            >
                                Nur löschen
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={deleteDialog.mode === 'remap' ? 'default' : 'outline'}
                                onClick={() => setDeleteDialog((prev) => ({ ...prev, mode: 'remap' }))}
                            >
                                Umlenken + löschen
                            </Button>
                        </div>
                        {deleteDialog.mode === 'remap' && (
                            <div className="space-y-2 rounded-lg border p-3">
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={deleteDialog.replaceType === 'existing' ? 'default' : 'outline'}
                                        onClick={() => setDeleteDialog((prev) => ({ ...prev, replaceType: 'existing' }))}
                                    >
                                        Auf bestehende Kategorie
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={deleteDialog.replaceType === 'new' ? 'default' : 'outline'}
                                        onClick={() => setDeleteDialog((prev) => ({ ...prev, replaceType: 'new' }))}
                                    >
                                        Auf neue Kategorie
                                    </Button>
                                </div>
                                {deleteDialog.replaceType === 'existing' ? (
                                    <Combobox
                                        items={renameTargets.map((tag) => ({ label: tag.name, value: tag.name }))}
                                        value={deleteDialog.replaceWith}
                                        onValueChange={(value) => setDeleteDialog((prev) => ({ ...prev, replaceWith: value }))}
                                    >
                                        <ComboboxInput
                                            placeholder="Ziel-Kategorie suchen..."
                                            className="h-10"
                                        />
                                        <ComboboxContent>
                                            <ComboboxList>
                                                {(item) => (
                                                    <ComboboxItem value={item.value}>
                                                        {item.label}
                                                    </ComboboxItem>
                                                )}
                                            </ComboboxList>
                                            <ComboboxEmpty>Keine Kategorie gefunden.</ComboboxEmpty>
                                        </ComboboxContent>
                                    </Combobox>
                                ) : (
                                    <Input
                                        placeholder="Neue Ziel-Kategorie"
                                        value={deleteDialog.newName}
                                        onChange={(e) => setDeleteDialog((prev) => ({ ...prev, newName: e.target.value }))}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialog({ open: false, name: '', mode: 'remove', replaceType: 'existing', replaceWith: '', newName: '' })}>Abbrechen</Button>
                        <Button variant="destructive" onClick={confirmDeleteDialog}>Löschen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default TagManagement;
