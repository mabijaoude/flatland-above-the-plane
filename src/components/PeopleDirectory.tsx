import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ResidentStatic } from "../types";

export type PeopleDirectoryResident = Pick<
  ResidentStatic,
  "id" | "name" | "sides" | "role"
> & {
  intent: string;
  destination: string;
  state: string;
  followUnavailableReason?: string;
  pickUpUnavailableReason?: string;
};

export type PeopleDirectoryProps = {
  residents: readonly PeopleDirectoryResident[];
  activeResidentId: number | null;
  followedResidentId: number | null;
  controlledResidentId: number | null;
  onLocate: (residentId: number) => void;
  onFollow: (residentId: number) => void;
  onPickUp: (residentId: number) => void;
  onCreateCitizen: () => void;
  onClose?: () => void;
  createUnavailableReason?: string;
  initialQuery?: string;
  autoFocusSearch?: boolean;
};

function matchesQuery(resident: PeopleDirectoryResident, query: string) {
  const searchable = [
    resident.name,
    String(resident.sides),
    resident.role,
    resident.intent,
    resident.destination,
    resident.state
  ];
  return searchable.some((value) => value.toLocaleLowerCase().includes(query));
}

function resultLabel(count: number, total: number, hasQuery: boolean) {
  if (!hasQuery) return `${total} ${total === 1 ? "citizen" : "citizens"} in the town.`;
  if (count === 0) return "No citizens match this search.";
  return `${count} of ${total} ${total === 1 ? "citizen" : "citizens"} shown.`;
}

export function PeopleDirectory({
  residents,
  activeResidentId,
  followedResidentId,
  controlledResidentId,
  onLocate,
  onFollow,
  onPickUp,
  onCreateCitizen,
  onClose,
  createUnavailableReason,
  initialQuery = "",
  autoFocusSearch = false
}: PeopleDirectoryProps) {
  const [query, setQuery] = useState(initialQuery);
  const componentId = useId();
  const titleId = `${componentId}-title`;
  const searchId = `${componentId}-search`;
  const resultsId = `${componentId}-results`;
  const createReasonId = `${componentId}-create-reason`;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredResidents = useMemo(
    () => normalizedQuery
      ? residents.filter((resident) => matchesQuery(resident, normalizedQuery))
      : residents,
    [normalizedQuery, residents]
  );

  return (
    <aside
      className="people-directory parchment-panel"
      aria-labelledby={titleId}
      data-resident-count={residents.length}
    >
      <header className="people-directory__header panel-heading">
        <div>
          <p className="eyebrow">Town directory</p>
          <h2 id={titleId}>Citizens</h2>
        </div>
        {onClose && (
          <button type="button" aria-label="Close Citizens" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        )}
      </header>

      <label className="people-directory__search" htmlFor={searchId}>
        <span>Find a citizen</span>
        <input
          id={searchId}
          type="search"
          value={query}
          autoFocus={autoFocusSearch}
          autoComplete="off"
          placeholder="Name, role, intent, or place"
          aria-controls={resultsId}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <p className="people-directory__summary" role="status" aria-live="polite" aria-atomic="true">
        {resultLabel(filteredResidents.length, residents.length, Boolean(normalizedQuery))}
      </p>

      {filteredResidents.length > 0 ? (
        <ol id={resultsId} className="people-directory__list">
          {filteredResidents.map((resident) => {
            const isActive = resident.id === activeResidentId;
            const isFollowed = resident.id === followedResidentId;
            const isControlled = resident.id === controlledResidentId;
            const residentId = `${componentId}-resident-${resident.id}`;
            const followReasonId = `${residentId}-follow-reason`;
            const pickUpReasonId = `${residentId}-pickup-reason`;
            const relationshipLabels = [
              isActive ? "In view" : null,
              isFollowed ? "Following" : null,
              isControlled ? "In control" : null
            ].filter((label): label is string => label !== null);

            return (
              <li key={resident.id}>
                <article
                  className={[
                    "people-directory__row",
                    isActive ? "is-active" : "",
                    isFollowed ? "is-followed" : "",
                    isControlled ? "is-controlled" : ""
                  ].filter(Boolean).join(" ")}
                  aria-labelledby={`${residentId}-name`}
                  aria-current={isActive || undefined}
                  data-resident-id={resident.id}
                >
                  <div className="people-directory__identity">
                    <h3 id={`${residentId}-name`}>{resident.name}</h3>
                    <p>{resident.sides} sides · {resident.role}</p>
                  </div>

                  {relationshipLabels.length > 0 && (
                    <p className="people-directory__relationships" aria-label="Current relationship">
                      {relationshipLabels.map((label) => <span key={label}>{label}</span>)}
                    </p>
                  )}

                  <dl className="people-directory__details">
                    <div className="people-directory__intent">
                      <dt>Now</dt>
                      <dd>{resident.intent}</dd>
                    </div>
                    <div className="people-directory__destination">
                      <dt>Going to</dt>
                      <dd>{resident.destination}</dd>
                    </div>
                    <div className="people-directory__state">
                      <dt>State</dt>
                      <dd>{resident.state}</dd>
                    </div>
                  </dl>

                  <div className="people-directory__actions" aria-label={`Actions for ${resident.name}`}>
                    <button
                      type="button"
                      aria-label={`Locate ${resident.name} in Survey`}
                      onClick={() => onLocate(resident.id)}
                    >
                      Locate
                    </button>
                    <button
                      type="button"
                      aria-label={`${isFollowed ? "Stop following" : "Follow"} ${resident.name}`}
                      aria-pressed={isFollowed}
                      aria-disabled={Boolean(resident.followUnavailableReason) || undefined}
                      aria-describedby={resident.followUnavailableReason ? followReasonId : undefined}
                      onClick={() => {
                        if (!resident.followUnavailableReason) onFollow(resident.id);
                      }}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                    <button
                      type="button"
                      className="is-primary"
                      aria-label={`Pick up ${resident.name}`}
                      aria-disabled={Boolean(resident.pickUpUnavailableReason) || undefined}
                      aria-describedby={resident.pickUpUnavailableReason ? pickUpReasonId : undefined}
                      onClick={() => {
                        if (!resident.pickUpUnavailableReason) onPickUp(resident.id);
                      }}
                    >
                      Pick up
                    </button>
                  </div>

                  {resident.followUnavailableReason && (
                    <p id={followReasonId} className="people-directory__unavailable">
                      Follow unavailable: {resident.followUnavailableReason}
                    </p>
                  )}
                  {resident.pickUpUnavailableReason && (
                    <p id={pickUpReasonId} className="people-directory__unavailable">
                      Pick up unavailable: {resident.pickUpUnavailableReason}
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <div id={resultsId} className="people-directory__empty">
          <p>No one matches “{query.trim()}”.</p>
          <button type="button" onClick={() => setQuery("")}>Clear search</button>
        </div>
      )}

      <div className="people-directory__create">
        <button
          type="button"
          aria-disabled={Boolean(createUnavailableReason) || undefined}
          aria-describedby={createUnavailableReason ? createReasonId : undefined}
          onClick={() => {
            if (!createUnavailableReason) onCreateCitizen();
          }}
        >
          Create a citizen
        </button>
        {createUnavailableReason && (
          <p id={createReasonId} className="people-directory__unavailable">
            Create unavailable: {createUnavailableReason}
          </p>
        )}
      </div>
    </aside>
  );
}
