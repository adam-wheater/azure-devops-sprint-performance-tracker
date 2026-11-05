import * as React from "react";
import { useState, useMemo } from "react";
import { TeamInfo } from "../models/interfaces";
import { Button, IconSearch } from "./ui";

interface Props {
  teams: TeamInfo[];
  selectedTeamIds: Set<string>;
  onChange: (teamIds: Set<string>) => void;
}

export const TeamSelector: React.FC<Props> = ({ teams, selectedTeamIds, onChange }) => {
  const [searchText, setSearchText] = useState("");

  const filteredTeams = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(query));
  }, [teams, searchText]);

  const allSelected =
    teams.length > 0 &&
    selectedTeamIds.size === teams.length &&
    teams.every((t) => selectedTeamIds.has(t.id));

  const toggleAll = () => {
    if (allSelected) {
      onChange(new Set());
    } else {
      onChange(new Set(teams.map((t) => t.id)));
    }
  };

  const toggleTeam = (teamId: string) => {
    const newSet = new Set(selectedTeamIds);
    if (newSet.has(teamId)) {
      newSet.delete(teamId);
    } else {
      newSet.add(teamId);
    }
    onChange(newSet);
  };

  return (
    <div className="ax-toolbar__group" style={{ flexWrap: "wrap" }}>
      <span className="ax-label">Teams</span>
      {teams.length > 5 && (
        <span className="ax-search">
          <span className="ax-search__icon">
            <IconSearch />
          </span>
          <input
            type="text"
            className="ax-input"
            placeholder="Filter teams..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Filter teams"
          />
        </span>
      )}
      <div className="ax-row" role="group" aria-label="Teams">
        <Button
          size="sm"
          variant={allSelected ? "primary" : "default"}
          aria-pressed={allSelected}
          onClick={toggleAll}
        >
          All
        </Button>
        {filteredTeams.map((team) => {
          const active = selectedTeamIds.has(team.id);
          return (
            <Button
              key={team.id}
              size="sm"
              variant={active ? "primary" : "default"}
              aria-pressed={active}
              onClick={() => toggleTeam(team.id)}
            >
              {team.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
