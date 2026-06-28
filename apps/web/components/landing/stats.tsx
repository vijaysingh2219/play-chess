const STATS = [
  { value: '12K+', label: 'Games played' },
  { value: '850+', label: 'Players online' },
  { value: '40+', label: 'Countries' },
  { value: '<60s', label: 'Avg. time to a match' },
];

export function Stats() {
  return (
    <section className="container mx-auto px-4 py-10">
      <dl className="border-border/60 bg-card grid grid-cols-2 gap-y-8 rounded-2xl border py-8 shadow-sm sm:grid-cols-4">
        {STATS.map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center text-center">
            <dt className="text-primary text-3xl font-bold tracking-tight sm:text-4xl">{value}</dt>
            <dd className="text-muted-foreground mt-1 text-sm">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
