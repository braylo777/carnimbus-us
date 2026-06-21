import React from 'react';

export default function CarNimbusDashboard() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center p-8">
      {/* KPI CENTER */}
      <div className="w-full max-w-4xl text-center py-12 border-b border-neutral-800">
        <h1 className="text-2xl text-neutral-400 uppercase tracking-widest">Close Rate</h1>
        <p className="text-8xl font-black text-emerald-400 mt-4">24.5%</p>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        {/* SECTION 1 */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 hover:border-emerald-500 transition-colors">
          <h2 className="text-xl font-bold mb-4">Upload Inventory</h2>
          <button className="w-full bg-emerald-500 text-black font-bold py-3 rounded-lg hover:bg-emerald-400 transition-colors">
            Select CSV
          </button>
        </div>

        {/* SECTION 2 */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 hover:border-emerald-500 transition-colors">
          <h2 className="text-xl font-bold mb-4">Appointments</h2>
          <ul className="space-y-3 text-neutral-300">
            <li className="flex justify-between items-center bg-neutral-800 p-3 rounded-lg">
              <span>10:00 AM - John D.</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">Test Drive</span>
            </li>
            <li className="flex justify-between items-center bg-neutral-800 p-3 rounded-lg">
              <span>1:30 PM - Sarah M.</span>
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Finance</span>
            </li>
          </ul>
        </div>

        {/* SECTION 3 */}
        <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 hover:border-emerald-500 transition-colors">
          <h2 className="text-xl font-bold mb-4">AI Suggestions</h2>
          <div className="bg-neutral-800 p-4 rounded-lg border-l-4 border-emerald-500">
            <p className="text-sm text-neutral-300 leading-relaxed">
              Call John D. to confirm the Taycan test drive setup. Mention the new lease incentives to increase closing probability.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
