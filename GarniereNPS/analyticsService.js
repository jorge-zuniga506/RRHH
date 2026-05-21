function classifyENPS(score) {
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'neutral';
  return 'detractor';
}

function getENPSMetrics(rows) {
  const total = rows.length || 1;
  const promoters = rows.filter(r => classifyENPS(r.enps_score) === 'promoter').length;
  const neutrals = rows.filter(r => classifyENPS(r.enps_score) === 'neutral').length;
  const detractors = rows.filter(r => classifyENPS(r.enps_score) === 'detractor').length;

  const promotersPct = (promoters / total) * 100;
  const detractorsPct = (detractors / total) * 100;
  const enps = promotersPct - detractorsPct;

  return {
    totalResponses: rows.length,
    promoters,
    neutrals,
    detractors,
    promotersPct: Number(promotersPct.toFixed(2)),
    detractorsPct: Number(detractorsPct.toFixed(2)),
    enps: Number(enps.toFixed(2))
  };
}

function getLikertAverages(rows) {
  if (!rows.length) {
    return {
      leadership: 0,
      communication: 0,
      growth: 0,
      benefits: 0,
      culture: 0,
      workLife: 0
    };
  }

  const sum = rows.reduce((acc, r) => {
    acc.leadership += r.leadership_score;
    acc.communication += r.communication_score;
    acc.growth += r.growth_score;
    acc.benefits += r.benefits_score;
    acc.culture += r.culture_score;
    acc.workLife += r.work_life_score;
    return acc;
  }, { leadership: 0, communication: 0, growth: 0, benefits: 0, culture: 0, workLife: 0 });

  return Object.fromEntries(
    Object.entries(sum).map(([k, v]) => [k, Number((v / rows.length).toFixed(2))])
  );
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] || 'Sin dato';
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return [...map.entries()].map(([segment, data]) => ({
    segment,
    ...getENPSMetrics(data),
    likert: getLikertAverages(data)
  }));
}

module.exports = {
  classifyENPS,
  getENPSMetrics,
  getLikertAverages,
  groupBy
};
