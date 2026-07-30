'use client';

import React, { useState, useEffect } from 'react';

interface Tournament {
    id: string;
    name: string;
    participants: number;
    status: string;
}

export default function TournamentsPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);

    useEffect(() => {
        // Mock fetching tournaments
        setTournaments([
            { id: '1', name: 'AWS Cloud Battle', participants: 150, status: 'Upcoming' },
            { id: '2', name: 'Linux Kernel Master', participants: 80, status: 'Live' }
        ]);
    }, []);

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Tournament Arena</h1>
            <div className="grid gap-4">
                {tournaments.map((t: any) => (
                    <div key={t.id} className="p-4 border rounded shadow-sm hover:shadow-md transition">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-semibold">{t.name}</h2>
                                <p className="text-gray-500">{t.participants} participants</p>
                            </div>
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                {t.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}