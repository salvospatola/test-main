import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export const PostSkeleton = () => (
    <Card className="shadow-md mb-6 animate-pulse border-border/50">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0 p-6 pb-4">
            <div className="bg-muted h-12 w-12 rounded-full"></div>
            <div className="space-y-2">
                <div className="bg-muted h-4 w-32 rounded-lg"></div>
                <div className="bg-muted h-3 w-20 rounded-md"></div>
            </div>
        </CardHeader>
        <CardContent className="space-y-3 p-6 pt-0">
            <div className="bg-muted h-4 w-full rounded-lg"></div>
            <div className="bg-muted h-4 w-5/6 rounded-lg"></div>
            <div className="bg-muted h-64 w-full rounded-xl mt-4"></div>
        </CardContent>
    </Card>
);

export const CardSkeleton = () => (
    <Card className="shadow-sm mb-4 animate-pulse border-border/50">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0 p-6 pb-4">
            <div className="bg-muted h-10 w-10 rounded-lg"></div>
            <div className="space-y-2">
                <div className="bg-muted h-5 w-40 rounded-lg"></div>
                <div className="bg-muted h-3 w-24 rounded-md"></div>
            </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-muted h-16 rounded-xl"></div>
                <div className="bg-muted h-16 rounded-xl"></div>
            </div>
            <div className="bg-muted h-32 rounded-xl"></div>
        </CardContent>
    </Card>
);

export const UserSkeleton = () => (
    <Card className="shadow-sm animate-pulse border-border/50 bg-muted/20">
        <CardContent className="p-5 space-y-4">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="bg-muted h-10 w-10 rounded-full"></div>
                    <div className="space-y-2">
                        <div className="bg-muted h-4 w-24 rounded"></div>
                        <div className="bg-muted h-3 w-16 rounded"></div>
                    </div>
                </div>
                <div className="bg-muted h-4 w-12 rounded-lg"></div>
            </div>
            <div className="space-y-2">
                <div className="bg-muted h-3 w-full rounded"></div>
                <div className="bg-muted h-3 w-2/3 rounded"></div>
            </div>
            <div className="flex gap-2 pt-2">
                <div className="bg-muted h-8 flex-1 rounded-md"></div>
                <div className="bg-muted h-8 w-10 rounded-md"></div>
            </div>
        </CardContent>
    </Card>
);

export const TableRowSkeleton = ({ cols = 5 }) => (
    <tr className="animate-pulse border-b last:border-0">
        {Array(cols).fill(0).map((_, i) => (
            <td key={i} className="px-4 py-4">
                <div className="bg-muted h-3 w-full rounded"></div>
            </td>
        ))}
    </tr>
);

export const ConsoleSkeleton = () => (
    <div className="space-y-2 p-4 animate-pulse">
        {Array(8).fill(0).map((_, i) => (
            <div key={i} className="flex gap-3 items-center">
                <div className="bg-muted h-3 w-16 rounded"></div>
                <div className="bg-muted h-2 w-12 rounded"></div>
                <div className="bg-muted h-3 flex-1 rounded"></div>
            </div>
        ))}
    </div>
);
