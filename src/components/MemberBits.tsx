import * as React from "react";
import { getRoleColor } from "../utils/formatting";
import { Pill } from "./ui";

function initialsFor(name: string): string {
  const words = name.split(/[\s.@_-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[1][0];
}

/** Profile picture when Azure DevOps supplied one, otherwise the person's initials. */
export const Avatar: React.FC<{ name: string; imageUrl?: string }> = ({ name, imageUrl }) =>
  imageUrl ? (
    <img
      className="ax-avatar"
      src={imageUrl}
      alt=""
      aria-hidden="true"
      style={{ objectFit: "cover" }}
    />
  ) : (
    <span className="ax-avatar" aria-hidden="true">
      {initialsFor(name)}
    </span>
  );

/** The member's primary capacity activity, with a colour dot that is never the only cue. */
export const RolePill: React.FC<{ role: string }> = ({ role }) => (
  <Pill>
    <span className="ax-dot" style={{ color: getRoleColor(role) }} aria-hidden="true" />
    {role}
  </Pill>
);

/** Avatar, name and an optional second line, as used in every people table. */
export const MemberName: React.FC<{
  name: string;
  imageUrl?: string;
  detail?: React.ReactNode;
}> = ({ name, imageUrl, detail }) => (
  <div className="ax-row" style={{ flexWrap: "nowrap" }}>
    <Avatar name={name} imageUrl={imageUrl} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 600 }}>{name}</div>
      {detail && <div className="ax-fine">{detail}</div>}
    </div>
  </div>
);
