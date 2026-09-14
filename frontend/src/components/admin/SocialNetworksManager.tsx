"use client";

import { useState } from "react";
import { Facebook, Twitter, Instagram, Youtube, Linkedin, MessageCircle } from "lucide-react";

interface SocialNetwork {
    id: string;
    name: string;
    icon: React.ComponentType<any>;
    connected: boolean;
    followers?: number;
    engagement?: number;
}

export default function SocialNetworksManager() {
    const [networks, setNetworks] = useState<SocialNetwork[]>([
        { id: "facebook", name: "Facebook", icon: Facebook, connected: false, followers: 0, engagement: 0 },
        { id: "twitter", name: "Twitter", icon: Twitter, connected: false, followers: 0, engagement: 0 },
        { id: "instagram", name: "Instagram", icon: Instagram, connected: false, followers: 0, engagement: 0 },
        { id: "youtube", name: "YouTube", icon: Youtube, connected: false, followers: 0, engagement: 0 },
        { id: "linkedin", name: "LinkedIn", icon: Linkedin, connected: false, followers: 0, engagement: 0 },
        { id: "tiktok", name: "TikTok", icon: MessageCircle, connected: false, followers: 0, engagement: 0 },
    ]);

    const handleConnect = (id: string) => {
        setNetworks(prev => prev.map(net =>
            net.id === id ? { ...net, connected: !net.connected } : net
        ));
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black tracking-tight">Network Hub</h2>
                <div className="text-sm text-neutral-400">
                    Optimize conversions across all platforms
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {networks.map((network) => {
                    const Icon = network.icon;
                    return (
                        <div
                            key={network.id}
                            className={`p-6 rounded-xl border transition-all duration-300 ${network.connected
                                    ? "border-green-500/30 bg-green-500/5"
                                    : "border-white/10 bg-white/5 hover:bg-white/10"
                                }`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Icon size={24} className={network.connected ? "text-green-500" : "text-neutral-400"} />
                                    <span className="font-semibold">{network.name}</span>
                                </div>
                                <div className={`w-3 h-3 rounded-full ${network.connected ? "bg-green-500" : "bg-neutral-500"}`} />
                            </div>

                            {network.connected && (
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-400">Followers</span>
                                        <span className="text-white">{network.followers?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-neutral-400">Engagement</span>
                                        <span className="text-white">{network.engagement}%</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => handleConnect(network.id)}
                                className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all ${network.connected
                                        ? "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20"
                                        : "bg-white/10 text-white hover:bg-white/20"
                                    }`}
                            >
                                {network.connected ? "Disconnect" : "Connect"}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <h3 className="text-xl font-bold mb-4">Conversion Optimization</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-black text-green-500">+45%</div>
                        <div className="text-sm text-neutral-400">Click-through Rate</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-black text-blue-500">+32%</div>
                        <div className="text-sm text-neutral-400">Engagement Boost</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-black text-purple-500">+28%</div>
                        <div className="text-sm text-neutral-400">Conversion Rate</div>
                    </div>
                </div>
            </div>
        </div>
    );
}