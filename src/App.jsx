import React, { useEffect, useMemo, useState } from "react";

/**
 * NFL FPL-style Fantasy — FULL MVP Frontend
 */

const BASE_URL = "https://nfl-fpl-backend.onrender.com"; // ← your Render URL

async function api(path, { method = "GET", body, userId } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "X-User": String(userId) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); msg = j.detail || JSON.stringify(j); } catch {}
    throw new Error(msg);
  }
  try { return await res.json(); } catch { return null; }
}

function Section({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}
function Input({ label, ...props }) {
  return (
    <label className="block mb-3">
      <span className="text-sm text-gray-600">{label}</span>
      <input className="mt-1 w-full border rounded-xl px-3 py-2 focus:outline-none focus:ring" {...props} />
    </label>
  );
}
function Button({ children, ...props }) {
  return (
    <button className="px-4 py-2 rounded-xl shadow bg-black text-white hover:opacity-90 disabled:opacity-50" {...props}>
      {children}
    </button>
  );
}
function Pill({ children }) {
  return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 border mr-2">{children}</span>;
}

export default function App() {
  const [userId, setUserId] = useState("");
  const [me, setMe] = useState(null);

  const [regName, setRegName] = useState("Marc");
  const [regEmail, setRegEmail] = useState("marc+demo@example.com");
  const [teamName, setTeamName] = useState("Marc's Marauders");

  const [leagueId, setLeagueId] = useState("");
  const [entryId, setEntryId] = useState(null);

  const [players, setPlayers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]); // 15
  const [gw, setGw] = useState(1);

  const [starters, setStarters] = useState([]); // 9
  const [captain, setCaptain] = useState(null);
  const [vice, setVice] = useState(null);
  const [chip, setChip] = useState(""); // BB | TC | WC

  const [standingsData, setStandingsData] = useState([]);

  const budgetUsed = useMemo(() => {
    const map = new Map(players.map((p) => [p.id, p.price || 0]));
    return selectedIds.reduce((a, id) => a + (map.get(id) || 0), 0);
  }, [selectedIds, players]);

  async function ensureDemoSeed() {
    try { await api("/demo/seed_all", { method: "POST" }); } catch {}
  }
  async function doRegister() {
    await ensureDemoSeed();
    const res = await api("/register", { method: "POST", body: { name: regName, email: regEmail } });
    setUserId(String(res.id));
    setMe({ id: res.id, name: regName, email: regEmail });
    alert("Registered!");
  }
  async function loadMe() {
    const res = await api("/me", { userId });
    setMe(res);
  }
  async function loadPlayers() {
    const res = await api("/players");
    setPlayers(res);
  }

  async function createLeague() {
    try {
      const res = await api("/league/create", { method: "POST", userId, body: { name: "UK NFL FPL League", team_name: teamName } });
      setLeagueId(String(res.league_id));
      setEntryId(res.entry_id);
      alert(`League created! ID: ${res.league_id}`);
    } catch (e) { alert(`Create league failed: ${e.message}`); }
  }
  async function joinLeague() {
    try {
      const res = await api("/league/join", { method: "POST", userId, body: { league_id: Number(leagueId), team_name: teamName } });
      setEntryId(res.entry_id);
      alert("Joined league!");
    } catch (e) { alert(`Join league failed: ${e.message}`); }
  }

  function togglePick(pid) {
    setSelectedIds((prev) => {
      if (prev.includes(pid)) return prev.filter((x) => x !== pid);
      if (prev.length >= 15) return prev;
      return [...prev, pid];
    });
  }
  async function saveSquad() {
    try {
      await api("/squad/set", { method: "POST", userId, body: { gameweek: Number(gw), player_ids: selectedIds } });
      alert("Squad saved");
    } catch (e) { alert(`Save squad failed: ${e.message}`); }
  }

  function toggleStarter(pid) {
    setStarters((prev) => {
      if (prev.includes(pid)) return prev.filter((x) => x !== pid);
      if (prev.length >= 9) return prev;
      return [...prev, pid];
    });
  }
  async function saveLineup() {
    if (!captain || !vice) return alert("Set captain & vice");
    try {
      await api("/lineup/set", {
        method: "POST",
        userId,
        body: { gameweek: Number(gw), starters, captain_id: captain, vice_captain_id: vice, chip: chip || null },
      });
      alert("Lineup saved");
    } catch (e) { alert(`Save lineup failed: ${e.message}`); }
  }

  async function loadStandings() {
    if (!leagueId) return;
    const res = await api(`/standings/${leagueId}`);
    setStandingsData(res);
  }

  // Admin helpers (testing)
  const [newGwId, setNewGwId] = useState(1);
  const [deadline, setDeadline] = useState("");
  const [statsJson, setStatsJson] = useState('[{"player_id": 1, "pass_yd": 250, "pass_td": 2}]');

  async function createGW() {
    const body = { id: Number(newGwId), name: `GW${newGwId}`, deadline_at: deadline || new Date(Date.now()+3600*1000).toISOString() };
    try { await api("/gameweeks/create", { method: "POST", userId, body }); alert("GW created"); }
    catch (e) { alert(`Create GW failed: ${e.message}`); }
  }
  async function uploadStats() {
    let stats;
    try { stats = JSON.parse(statsJson); } catch { return alert("Invalid JSON"); }
    try { await api("/stats/upload", { method: "POST", userId, body: { gameweek: Number(gw), stats } }); alert("Stats uploaded"); }
    catch (e) { alert(`Upload stats failed: ${e.message}`); }
  }
  async function computeGW() {
    try {
      const res = await api(`/compute/${gw}`, { method: "POST" });
      alert("GW computed\n" + JSON.stringify(res.gw_points, null, 2));
      await loadStandings();
    } catch (e) { alert(`Compute failed: ${e.message}`); }
  }

  useEffect(() => { loadPlayers(); }, []);

  const posGroups = useMemo(() => {
    const g = { QB: [], RB: [], WR: [], TE: [], K: [], DST: [] };
    for (const p of players) g[p.position]?.push(p);
    return g;
  }, [players]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="p-5 border-b bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="font-bold text-lg">NFL Fantasy (FPL-Style) — MVP</div>
          <div className="text-sm text-gray-600">{me ? <>Signed in as <b>{me.name}</b></> : "Not signed in"}</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-5">
        {/* Auth */}
        <Section title="Register / Login">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Input label="Name" value={regName} onChange={(e) => setRegName(e.target.value)} />
              <Input label="Email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
              <Button onClick={doRegister}>Register</Button>
              {userId && <span className="ml-3 text-sm">User ID: <code className="bg-gray-100 px-2 py-1 rounded">{userId}</code></span>}
            </div>
            <div>
              <Input label="Existing User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
              <Button onClick={loadMe}>Load Account</Button>
              {me && <Pill>{me.email}</Pill>}
            </div>
          </div>
        </Section>

        {/* League */}
        <Section title="League">
          <div className="grid md:grid-cols-3 gap-6 items-end">
            <div>
              <Input label="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
              <Button disabled={!userId} onClick={createLeague}>Create League</Button>
            </div>
            <div>
              <Input label="League ID" value={leagueId} onChange={(e) => setLeagueId(e.target.value)} />
              <Button disabled={!userId || !leagueId} onClick={joinLeague}>Join League</Button>
            </div>
            <div className="text-sm">
              <div>League ID: <b>{leagueId || "-"}</b></div>
              <div>Entry ID: <b>{entryId || "-"}</b></div>
            </div>
          </div>
        </Section>

        {/* Squad */}
        <Section title="Build Squad (15 players)" right={<div className="text-sm">Budget used: <b>{budgetUsed.toFixed(1)}</b> / 100.0</div>}>
          <div className="mb-4 flex gap-4 items-center">
            <label className="text-sm">Gameweek</label>
            <input className="w-20 border rounded px-2 py-1" type="number" min={1} value={gw} onChange={(e)=>setGw(Number(e.target.value)||1)} />
            <Button disabled={!userId || !entryId || selectedIds.length!==15} onClick={saveSquad}>Save Squad</Button>
            <span className="text-sm text-gray-500">Pick exactly 15 players.</span>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(posGroups).map(([pos, list]) => (
              <div key={pos} className="bg-gray-50 border rounded-xl p-3">
                <div className="font-semibold mb-2">{pos}</div>
                <div className="space-y-2 max-h-72 overflow-auto pr-2">
                  {list.map((p) => {
                    const picked = selectedIds.includes(p.id);
                    return (
                      <div key={p.id} className={`flex items-center justify-between border rounded-lg px-3 py-2 ${picked?"bg-black text-white border-black":"bg-white"}`}>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs opacity-80">{p.team} · £{(p.price||0).toFixed(1)}m</div>
                        </div>
                        <Button onClick={() => togglePick(p.id)}>{picked ? "Remove" : "Pick"}</Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Lineup */}
        <Section title="Set Lineup (9 starters + C/VC)">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="font-semibold mb-2">Your Squad</div>
              <div className="space-y-2 max-h-80 overflow-auto pr-2">
                {selectedIds.map((id) => {
                  const p = players.find((x) => x.id === id);
                  if (!p) return null;
                  const isStarter = starters.includes(id);
                  return (
                    <div key={id} className={`flex items-center justify-between border rounded-lg px-3 py-2 ${isStarter?"bg-emerald-600 text-white border-emerald-700":"bg-white"}`}>
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs opacity-80">{p.position} · {p.team}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => toggleStarter(id)}>{isStarter ? "Unset" : "Start"}</Button>
                        <Button onClick={() => setCaptain(id)} disabled={!isStarter}>C</Button>
                        <Button onClick={() => setVice(id)} disabled={!isStarter}>VC</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="font-semibold mb-2">Starters (9)</div>
              <div className="space-y-2">
                {starters.map((id) => {
                  const p = players.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center justify-between border rounded-lg px-3 py-2 bg-white">
                      <div>
                        <div className="font-medium">{p?.name}</div>
                        <div className="text-xs text-gray-500">{p?.position} · {p?.team}</div>
                      </div>
                      <div className="text-xs">
                        {captain===id && <Pill>Captain</Pill>}
                        {vice===id && <Pill>Vice</Pill>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Chip</label>
                  <select className="w-full border rounded-xl px-3 py-2" value={chip} onChange={(e)=>setChip(e.target.value)}>
                    <option value="">None</option>
                    <option value="BB">Bench Boost</option>
                    <option value="TC">Triple Captain</option>
                    <option value="WC">Wildcard</option>
                  </select>
                </div>
                <div className="col-span-2 flex gap-3">
                  <Button disabled={starters.length!==9 || !captain || !vice || !userId} onClick={saveLineup}>Save Lineup</Button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Standings */}
        <Section title="Standings">
          <div className="flex items-center gap-3 mb-3">
            <Input label="League ID" value={leagueId} onChange={(e)=>setLeagueId(e.target.value)} />
            <Button onClick={loadStandings} disabled={!leagueId}>Refresh Standings</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-6">#</th>
                  <th className="py-2 pr-6">Team</th>
                  <th className="py-2 pr-6">Points</th>
                </tr>
              </thead>
              <tbody>
                {standingsData.map((row, idx)=> (
                  <tr key={row.entry_id} className="border-b last:border-0">
                    <td className="py-2 pr-6">{idx+1}</td>
                    <td className="py-2 pr-6">{row.team_name}</td>
                    <td className="py-2 pr-6 font-semibold">{row.points}</td>
                  </tr>
                ))}
                {!standingsData.length && (
                  <tr><td className="py-3 text-gray-500" colSpan={3}>No standings yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Admin (testing only) */}
        <Section title="Admin (Testing Only)">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <Input label="New GW ID" type="number" value={newGwId} onChange={(e)=>setNewGwId(e.target.value)} />
              <Input label="Deadline (ISO)" value={deadline} onChange={(e)=>setDeadline(e.target.value)} placeholder="2025-10-02T20:00:00Z" />
              <Button disabled={!userId} onClick={createGW}>Create GW</Button>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Stats JSON</label>
              <textarea className="w-full border rounded-xl p-3 h-40" value={statsJson} onChange={(e)=>setStatsJson(e.target.value)} />
              <div className="flex gap-3 mt-2">
                <Button disabled={!userId} onClick={uploadStats}>Upload Stats</Button>
                <Button onClick={computeGW}>Compute GW</Button>
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
