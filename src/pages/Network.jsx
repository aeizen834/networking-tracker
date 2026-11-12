// Intro map: a tree of who introduced you to whom, built from "How We Met".
// A good example of a recursive React component.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../lib/DataContext.jsx';
import { PageHeader, Card, HealthBadge } from '../components/ui.jsx';

function Branch({ node, childrenOf, profileById, depth = 0, seen }) {
  const [open, setOpen] = useState(depth < 2);
  const kids = seen.has(node.name) ? [] : childrenOf.get(node.name) || [];
  const nextSeen = new Set(seen).add(node.name); // guards against loops (A met B via B)
  const profile = node.id ? profileById.get(node.id) : null;

  return (
    <li>
      <div className="tree-node">
        {kids.length > 0 ? (
          <button className="tree-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? '▾' : '▸'}</button>
        ) : (
          <span className="tree-toggle" />
        )}
        {node.id ? <Link to={`/people/${node.id}`}>{node.name}</Link> : <strong>{node.name}</strong>}
        {node.company && <span className="muted small">{node.company}</span>}
        {profile && <HealthBadge health={profile.health} />}
        {kids.length > 0 && <span className="count">{kids.length}</span>}
      </div>
      {open && kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <Branch key={k.id} node={k} childrenOf={childrenOf} profileById={profileById} depth={depth + 1} seen={nextSeen} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Network() {
  const { people, profiles } = useData();

  const { roots, childrenOf, profileById } = useMemo(() => {
    const childrenOf = new Map();
    for (const p of people) {
      const key = p.howWeMet || 'Unknown';
      if (!childrenOf.has(key)) childrenOf.set(key, []);
      childrenOf.get(key).push(p);
    }
    for (const list of childrenOf.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    const names = new Set(people.map((p) => p.name));
    // Roots are introducers who aren't themselves in your People list (e.g. Me, family, or someone not tracked)
    const roots = [...childrenOf.keys()]
      .filter((k) => !names.has(k))
      .map((k) => ({ name: k }))
      .sort((a, b) => (childrenOf.get(b.name).length - childrenOf.get(a.name).length) || a.name.localeCompare(b.name));
    return { roots, childrenOf, profileById: new Map(profiles.map((p) => [p.person.id, p])) };
  }, [people, profiles]);

  return (
    <>
      <PageHeader
        title="Intro Map"
        subtitle="Who introduced you to whom. Warm intros branch out from the people at the top."
      />
      <Card>
        <ul className="tree">
          {roots.map((r) => (
            <Branch key={r.name} node={r} childrenOf={childrenOf} profileById={profileById} seen={new Set()} />
          ))}
        </ul>
      </Card>
    </>
  );
}
