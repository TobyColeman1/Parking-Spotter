// Parking Spotter: "Report incorrect info".
// For now reports are kept only in this browser (localStorage).
// To share them with everyone, replace the body of save() with a call to a database
// (for example Supabase). The rest of the app only calls Reports.save().

const Reports = {
  async save(report) { // report = { spotId, type }
    const entry = { id: report.spotId, type: report.type, at: Date.now() };
    try {
      const all = JSON.parse(localStorage.getItem("ps-reports") || "[]");
      all.push(entry);
      localStorage.setItem("ps-reports", JSON.stringify(all));
    } catch (e) { /* storage blocked (private window): ignore, as before */ }
    return entry;
  }
};
