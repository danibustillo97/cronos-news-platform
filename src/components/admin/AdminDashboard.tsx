"use client";
import { ArrowUpRight, ArrowDownRight, Users, Eye, MousePointer, Clock, Zap, Activity } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const stats = [
    { title: "Total Views", value: "124.5K", change: "+12.5%", trend: "up", icon: Eye, color: "text-blue-500" },
    { title: "Active Users", value: "45.2K", change: "+8.1%", trend: "up", icon: Users, color: "text-green-500" },
    { title: "Avg. CTR", value: "2.4%", change: "-0.5%", trend: "down", icon: MousePointer, color: "text-purple-500" },
    { title: "Time on Site", value: "4m 32s", change: "+14.2%", trend: "up", icon: Clock, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-colors group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-black/40 ${stat.color} group-hover:scale-110 transition-transform`}>
                <stat.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
                stat.trend === 'up' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
              }`}>
                {stat.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.change}
              </div>
            </div>
            <h3 className="text-neutral-400 text-sm font-medium">{stat.title}</h3>
            <p className="text-3xl font-black text-white mt-1 tracking-tight">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Chart */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                 <Activity size={20} className="text-red-500" />
                 Traffic Performance
               </h3>
               <p className="text-neutral-500 text-sm">Real-time data stream</p>
            </div>
            <div className="flex bg-black/40 rounded-lg p-1 border border-white/5">
                {['1H', '24H', '7D', '30D'].map(t => (
                    <button key={t} className="px-3 py-1 text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors">
                        {t}
                    </button>
                ))}
            </div>
          </div>
          
          {/* Custom CSS Chart Mock */}
          <div className="h-64 flex items-end justify-between gap-3 px-2 relative z-10">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((height, i) => (
              <div key={i} className="w-full bg-white/5 rounded-t-lg relative group overflow-hidden">
                 <motion.div 
                   initial={{ height: 0 }}
                   animate={{ height: `${height}%` }}
                   transition={{ duration: 1, delay: i * 0.05, ease: "easeOut" }}
                   className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-600 to-red-400 opacity-80 group-hover:opacity-100 transition-opacity rounded-t-sm"
                 />
                 <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-black border border-white/20 text-white text-xs font-mono py-1 px-2 rounded transition-opacity whitespace-nowrap z-20 shadow-xl pointer-events-none">
                    {height * 124} views
                 </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-6 text-xs text-neutral-500 font-mono px-2">
            <span>00:00</span><span>02:00</span><span>04:00</span><span>06:00</span><span>08:00</span><span>10:00</span>
            <span>12:00</span><span>14:00</span><span>16:00</span><span>18:00</span><span>20:00</span><span>22:00</span>
          </div>
        </div>

        {/* Sources / AI Insight */}
        <div className="bg-gradient-to-b from-neutral-900 to-black p-8 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
          
          <div className="relative z-10 mb-auto">
             <div className="flex items-center gap-2 mb-6">
                 <div className="p-2 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg">
                    <Zap size={18} className="text-white" />
                 </div>
                 <h3 className="text-lg font-bold text-white">AI Insights</h3>
             </div>
             
             <div className="space-y-4">
                <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                   <p className="text-neutral-300 text-sm leading-relaxed">
                      <span className="text-purple-400 font-bold">Trend Alert:</span> Football articles are performing 24% better than average today. Consider publishing more Champions League content.
                   </p>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
                   <p className="text-neutral-300 text-sm leading-relaxed">
                      <span className="text-blue-400 font-bold">SEO Tip:</span> 3 recent drafts are missing meta-descriptions. Fixing this could boost traffic by ~5%.
                   </p>
                </div>
             </div>
          </div>

          <button className="w-full mt-8 py-4 rounded-xl bg-white text-black font-bold text-sm hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)] relative z-10">
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}
