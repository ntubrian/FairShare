import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { PopupMessage, PopupMessages } from "../../components/PopupMessages";
import {
  AddParticipantDocument,
  MemberRole,
  ProjectDetailDocument,
  ProjectParticipantsDocument,
  ProjectStatus,
  RemoveParticipantDocument,
  SetMemberRoleDocument,
} from "../../graphql/generated";
import { toFriendlyError } from "../../lib/errors";
import styles from "./MembersScreen.module.scss";

type MembersScreenProps = {
  projectId: string;
  viewerId: string;
  viewerName: string;
  onBack: () => void;
  onOpenExpenses: () => void;
  onLogout: () => Promise<void> | void;
};

type RoleDraft = Record<string, MemberRole>;

type OwnershipTransferPlan =
  | {
      valid: true;
      targetName: string;
      nextSelfRole: MemberRole;
    }
  | {
      valid: false;
      nextSelfRole: MemberRole;
    };

const toInitials = (name: string) => {
  const normalized = name.trim();
  if (!normalized) {
    return "U";
  }
  const tokens = normalized.split(/\s+/).slice(0, 2);
  const letters = tokens
    .map((token) => token.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
  return letters || normalized.slice(0, 1).toUpperCase();
};

const buildRoleDraftMap = (
  members: Array<{ userId: string; role: MemberRole }>
): RoleDraft => {
  const next: RoleDraft = {};
  for (const member of members) {
    next[member.userId] = member.role;
  }
  return next;
};

const roleLabel = (role: MemberRole) => {
  if (role === MemberRole.Owner) {
    return "Owner";
  }
  if (role === MemberRole.Editor) {
    return "Editor";
  }
  return "Viewer";
};

const toParticipantNameKey = (name: string) => name.trim().toLowerCase();

export const MembersScreen = ({
  projectId,
  viewerId,
  viewerName,
  onBack,
  onOpenExpenses,
  onLogout,
}: MembersScreenProps) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [roleDrafts, setRoleDrafts] = useState<RoleDraft>({});
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleSaveLoading, setRoleSaveLoading] = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  const [participantInput, setParticipantInput] = useState("");
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [removeBusyParticipantId, setRemoveBusyParticipantId] = useState<
    string | null
  >(null);
  const [removeBlockedDialogOpen, setRemoveBlockedDialogOpen] = useState(false);
  const [removeBlockedHint, setRemoveBlockedHint] = useState("");
  const [removeBlockedName, setRemoveBlockedName] = useState("");

  const [notice, setNotice] = useState<string | null>(null);
  const [dismissedScreenError, setDismissedScreenError] = useState<
    string | null
  >(null);
  const roleDraftSeedRef = useRef("");

  const {
    data: projectData,
    loading: projectLoading,
    error: projectError,
    refetch: refetchProject,
  } = useQuery(ProjectDetailDocument, {
    variables: { projectId },
    fetchPolicy: "network-only",
  });
  const {
    data: participantsData,
    loading: participantsLoading,
    error: participantsError,
    refetch: refetchParticipants,
  } = useQuery(ProjectParticipantsDocument, {
    variables: { projectId, page: 1, pageSize: 200 },
    fetchPolicy: "network-only",
  });

  const [setMemberRole] = useMutation(SetMemberRoleDocument);
  const [addParticipant, { loading: addParticipantLoading }] = useMutation(
    AddParticipantDocument
  );
  const [removeParticipant] = useMutation(RemoveParticipantDocument);

  const project = projectData?.project;
  const members = project?.members ?? [];
  const participants = participantsData?.participants ?? [];
  const isProjectArchived = project?.status === ProjectStatus.Archived;

  const viewerProjectRole =
    members.find((member) => member.userId === viewerId)?.role ??
    MemberRole.Viewer;

  const canManageRoles =
    !isProjectArchived && viewerProjectRole === MemberRole.Owner;
  const canManageParticipants =
    !isProjectArchived &&
    (viewerProjectRole === MemberRole.Owner ||
      viewerProjectRole === MemberRole.Editor);
  const memberEmailByUserId = useMemo(() => {
    const next = new Map<string, string>();
    for (const member of members) {
      const email = member.user?.email?.trim();
      if (!email) {
        continue;
      }
      next.set(member.userId, email);
    }
    return next;
  }, [members]);
  const participantNameStats = useMemo(() => {
    const next = new Map<
      string,
      { total: number; manual: number; linked: number }
    >();
    for (const participant of participants) {
      const key = toParticipantNameKey(participant.name);
      const current = next.get(key) ?? { total: 0, manual: 0, linked: 0 };
      current.total += 1;
      if (participant.userId) {
        current.linked += 1;
      } else {
        current.manual += 1;
      }
      next.set(key, current);
    }
    return next;
  }, [participants]);
  const hasIdentityCollision = useMemo(
    () =>
      Array.from(participantNameStats.values()).some(
        (entry) => entry.manual > 0 && entry.linked > 0
      ),
    [participantNameStats]
  );

  const roleSeed = useMemo(
    () => members.map((member) => `${member.userId}:${member.role}`).join("|"),
    [members]
  );

  useEffect(() => {
    if (roleSeed === roleDraftSeedRef.current) {
      return;
    }
    roleDraftSeedRef.current = roleSeed;
    setRoleDrafts(buildRoleDraftMap(members));
  }, [members, roleSeed]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!accountMenuRef.current?.contains(target)) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  const refreshAll = async () => {
    setRefreshing(true);
    setRoleError(null);
    setParticipantError(null);
    try {
      await Promise.all([
        refetchProject({ projectId }),
        refetchParticipants({ projectId, page: 1, pageSize: 200 }),
      ]);
    } catch (error) {
      const message = toFriendlyError(error);
      if (message) {
        setParticipantError(message);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const roleChanges = useMemo(
    () =>
      members
        .map((member) => ({
          userId: member.userId,
          currentRole: member.role,
          nextRole: roleDrafts[member.userId] ?? member.role,
        }))
        .filter((member) => member.currentRole !== member.nextRole),
    [members, roleDrafts]
  );

  const ownerCountInDraft = useMemo(
    () =>
      members.reduce((count, member) => {
        const role = roleDrafts[member.userId] ?? member.role;
        return role === MemberRole.Owner ? count + 1 : count;
      }, 0),
    [members, roleDrafts]
  );

  const isLoading = projectLoading || participantsLoading;
  const hasRoleChanges = roleChanges.length > 0;

  const ownershipTransferPlan = useMemo<OwnershipTransferPlan | null>(() => {
    const selfMember = members.find((member) => member.userId === viewerId);
    if (!selfMember || selfMember.role !== MemberRole.Owner) {
      return null;
    }

    const nextSelfRole = roleDrafts[viewerId] ?? selfMember.role;
    if (nextSelfRole === MemberRole.Owner) {
      return null;
    }

    const finalOtherOwners = members.filter((member) => {
      if (member.userId === viewerId) {
        return false;
      }
      const nextRole = roleDrafts[member.userId] ?? member.role;
      return nextRole === MemberRole.Owner;
    });

    if (finalOtherOwners.length !== 1) {
      return {
        valid: false,
        nextSelfRole,
      };
    }

    const target = finalOtherOwners[0];
    return {
      valid: true,
      targetName: target.user?.displayName || target.userId,
      nextSelfRole,
    };
  }, [members, roleDrafts, viewerId]);

  const executeSaveRoles = async () => {
    if (!canManageRoles || !hasRoleChanges) {
      return;
    }

    setTransferConfirmOpen(false);
    setRoleSaveLoading(true);
    setRoleError(null);

    const promotions = roleChanges.filter(
      (change) =>
        change.nextRole === MemberRole.Owner &&
        change.currentRole !== MemberRole.Owner &&
        change.userId !== viewerId
    );
    const selfChanges = roleChanges.filter(
      (change) => change.userId === viewerId
    );
    const otherChanges = roleChanges.filter(
      (change) =>
        change.userId !== viewerId &&
        !(
          change.nextRole === MemberRole.Owner &&
          change.currentRole !== MemberRole.Owner
        )
    );
    const queue = [...promotions, ...otherChanges, ...selfChanges];

    try {
      for (const change of queue) {
        await setMemberRole({
          variables: {
            projectId,
            userId: change.userId,
            role: change.nextRole,
          },
        });
      }
      await refetchProject({ projectId });
      setNotice(
        `Saved ${queue.length} role change${queue.length > 1 ? "s" : ""}.`
      );
    } catch (error) {
      setRoleError(
        toFriendlyError(error) || "Failed to update roles. Please retry."
      );
    } finally {
      setRoleSaveLoading(false);
    }
  };

  const onSaveRoles = async () => {
    if (!canManageRoles || !hasRoleChanges || roleSaveLoading || isLoading) {
      return;
    }

    if (ownershipTransferPlan) {
      if (!ownershipTransferPlan.valid) {
        setRoleError("Transfer requires exactly one remaining Owner.");
        return;
      }
      setRoleError(null);
      setTransferConfirmOpen(true);
      return;
    }

    await executeSaveRoles();
  };

  const onResetRoles = () => {
    setRoleDrafts(buildRoleDraftMap(members));
    setRoleError(null);
    setTransferConfirmOpen(false);
  };

  const onAddParticipant = async () => {
    if (!canManageParticipants || addParticipantLoading) {
      return;
    }

    setParticipantError(null);
    const normalizedName = participantInput.trim();
    if (!normalizedName) {
      setParticipantError("Participant name is required.");
      return;
    }

    const duplicate = participants.some(
      (participant) =>
        participant.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicate) {
      setParticipantError("This participant is already in the project.");
      return;
    }

    try {
      await addParticipant({
        variables: {
          projectId,
          name: normalizedName,
        },
      });
      setParticipantInput("");
      await Promise.all([
        refetchParticipants({ projectId, page: 1, pageSize: 200 }),
        refetchProject({ projectId }),
      ]);
      setNotice("Participant added.");
    } catch (error) {
      setParticipantError(
        toFriendlyError(error) || "Failed to add participant."
      );
    }
  };

  const onRemoveParticipant = async (
    participantId: string,
    participantName: string
  ) => {
    if (!canManageParticipants) {
      return;
    }

    setParticipantError(null);
    setRemoveBusyParticipantId(participantId);

    try {
      const result = await removeParticipant({
        variables: {
          projectId,
          participantId,
        },
      });
      if (!result.data?.removeParticipant) {
        throw new Error("Failed to remove participant.");
      }
      await Promise.all([
        refetchParticipants({ projectId, page: 1, pageSize: 200 }),
        refetchProject({ projectId }),
      ]);
      setNotice("Participant removed.");
    } catch (error) {
      const message = toFriendlyError(error);
      if (message.includes("active expenses")) {
        setRemoveBlockedDialogOpen(true);
        setRemoveBlockedHint(message);
        setRemoveBlockedName(participantName);
      } else {
        setParticipantError(message || "Failed to remove participant.");
      }
    } finally {
      setRemoveBusyParticipantId(null);
    }
  };

  const onLogoutFromMenu = async () => {
    setAccountMenuOpen(false);
    await onLogout();
  };

  const screenError = useMemo(() => {
    const firstError = projectError || participantsError;
    if (!firstError) {
      return null;
    }
    const message = toFriendlyError(firstError);
    return message || null;
  }, [projectError, participantsError]);
  const visibleScreenError =
    screenError && screenError !== dismissedScreenError ? screenError : null;

  useEffect(() => {
    if (!screenError) {
      setDismissedScreenError(null);
    }
  }, [screenError]);

  const popupMessages: PopupMessage[] = [];
  if (notice) {
    popupMessages.push({
      id: `members-notice-${notice}`,
      tone: "info",
      message: notice,
      onDismiss: () => setNotice(null),
    });
  }
  if (visibleScreenError) {
    popupMessages.push({
      id: `members-screen-error-${visibleScreenError}`,
      tone: "error",
      message: visibleScreenError,
      onDismiss: () => setDismissedScreenError(visibleScreenError),
    });
  }
  if (roleError) {
    popupMessages.push({
      id: `members-role-error-${roleError}`,
      tone: "error",
      message: roleError,
      onDismiss: () => setRoleError(null),
    });
  }
  if (participantError) {
    popupMessages.push({
      id: `members-participant-error-${participantError}`,
      tone: "error",
      message: participantError,
      onDismiss: () => setParticipantError(null),
    });
  }

  return (
    <main className={styles.screen}>
      <PopupMessages messages={popupMessages} />
      <header className={styles.headerCard}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to projects"
        >
          ←
        </button>
        <div className={styles.headerTitle}>
          <h1>Members</h1>
          <p>{project?.name ?? "Project"}</p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.syncButton}
            onClick={() => void refreshAll()}
            disabled={refreshing}
          >
            {refreshing ? "Syncing..." : "Synced"}
          </button>
          <div className={styles.accountMenu} ref={accountMenuRef}>
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
            >
              {viewerName.charAt(0).toUpperCase() || "U"}
            </button>
            {accountMenuOpen ? (
              <div
                className={styles.accountDropdown}
                role="menu"
                aria-label="Account actions"
              >
                <p className={styles.accountName}>{viewerName}</p>
                <button
                  type="button"
                  className={styles.accountLogoutButton}
                  role="menuitem"
                  onClick={() => void onLogoutFromMenu()}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2>Roles & Members</h2>
          <p>Only Owner can change roles.</p>
        </div>

        <div className={styles.memberList}>
          {members.map((member) => {
            const roleValue = roleDrafts[member.userId] ?? member.role;
            const isSelf = member.userId === viewerId;
            const selfOwnerGuard =
              isSelf &&
              roleValue === MemberRole.Owner &&
              ownerCountInDraft <= 1;
            const disableRoleSelect =
              !canManageRoles || roleSaveLoading || selfOwnerGuard;
            const userName = member.user?.displayName || member.userId;
            const userEmail = member.user?.email || "No email";

            return (
              <article key={member.userId} className={styles.memberRow}>
                <div className={styles.memberMeta}>
                  <span className={styles.avatar}>{toInitials(userName)}</span>
                  <div>
                    <p className={styles.memberName}>{userName}</p>
                    <p className={styles.memberEmail}>{userEmail}</p>
                    {selfOwnerGuard ? (
                      <p className={styles.rowHint}>
                        You can&apos;t downgrade yourself until another Owner is
                        assigned.
                      </p>
                    ) : null}
                  </div>
                </div>
                <label className={styles.roleField}>
                  <span className={styles.srOnly}>Role for {userName}</span>
                  <select
                    value={roleValue}
                    disabled={disableRoleSelect}
                    onChange={(event) =>
                      setRoleDrafts((current) => ({
                        ...current,
                        [member.userId]: event.target.value as MemberRole,
                      }))
                    }
                  >
                    <option value={MemberRole.Owner}>Owner</option>
                    <option value={MemberRole.Editor}>Editor</option>
                    <option value={MemberRole.Viewer}>Viewer</option>
                  </select>
                </label>
              </article>
            );
          })}
        </div>

        <div className={styles.sectionActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onResetRoles}
            disabled={!hasRoleChanges || roleSaveLoading}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void onSaveRoles()}
            disabled={
              !canManageRoles || !hasRoleChanges || roleSaveLoading || isLoading
            }
          >
            {roleSaveLoading ? "Saving..." : "Save role changes"}
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2>Participants ({participants.length})</h2>
          <p>
            {canManageParticipants
              ? "Add or remove participants for this project."
              : "Your role cannot manage participants."}
          </p>
        </div>
        {hasIdentityCollision ? (
          <p className={styles.identityCollisionHint}>
            Same-name participants are kept separate when one is Manual and one
            is Linked.
          </p>
        ) : null}

        <div className={styles.participantList}>
          {participants.map((participant) => {
            const isLinkedMember = Boolean(participant.userId);
            const nameStats = participantNameStats.get(
              toParticipantNameKey(participant.name)
            );
            const hasCollisionVariant = Boolean(
              nameStats && nameStats.manual > 0 && nameStats.linked > 0
            );
            const linkedEmail = participant.userId
              ? memberEmailByUserId.get(participant.userId)
              : null;
            const secondaryIdentityLabel = isLinkedMember
              ? linkedEmail || "Linked project member"
              : "Manual participant";
            const isBusyRemoving = removeBusyParticipantId === participant.id;
            const disableRemove =
              !canManageParticipants ||
              isLinkedMember ||
              Boolean(removeBusyParticipantId);
            const removeButtonClassName = `${styles.removeButton} ${
              isLinkedMember
                ? styles.removeButtonLock
                : styles.removeButtonDanger
            } ${isBusyRemoving ? styles.removeButtonBusy : ""}`;
            const removeButtonText = isBusyRemoving
              ? "..."
              : isLinkedMember
              ? "Locked"
              : "Remove";

            return (
              <article
                key={participant.id}
                className={`${styles.participantRow} ${
                  hasCollisionVariant ? styles.participantRowCollision : ""
                }`}
              >
                <div className={styles.memberMeta}>
                  <span className={styles.avatar}>
                    {toInitials(participant.name)}
                  </span>
                  <div>
                    <p className={styles.memberName}>{participant.name}</p>
                    <div className={styles.participantBadgeRow}>
                      <span
                        className={`${styles.identityBadge} ${
                          isLinkedMember
                            ? styles.identityBadgeLinked
                            : styles.identityBadgeManual
                        }`}
                      >
                        {isLinkedMember ? "Linked" : "Manual"}
                      </span>
                      {hasCollisionVariant ? (
                        <span className={styles.collisionBadge}>
                          Name collision
                        </span>
                      ) : null}
                    </div>
                    <p className={styles.memberEmail}>
                      {secondaryIdentityLabel}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={removeButtonClassName}
                  onClick={() =>
                    void onRemoveParticipant(participant.id, participant.name)
                  }
                  disabled={disableRemove}
                  aria-label={
                    isLinkedMember
                      ? "Locked member participant"
                      : "Remove participant"
                  }
                  title={
                    isLinkedMember
                      ? "Linked members cannot be removed from participants."
                      : undefined
                  }
                >
                  {removeButtonText}
                </button>
              </article>
            );
          })}
        </div>

        <div className={styles.addRow}>
          <input
            value={participantInput}
            disabled={!canManageParticipants || addParticipantLoading}
            placeholder="Add participant name"
            onChange={(event) => setParticipantInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onAddParticipant();
              }
            }}
          />
          <button
            type="button"
            disabled={!canManageParticipants || addParticipantLoading}
            onClick={() => void onAddParticipant()}
          >
            {addParticipantLoading ? "Adding..." : "Add"}
          </button>
        </div>
      </section>

      {removeBlockedDialogOpen ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => setRemoveBlockedDialogOpen(false)}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Cannot remove participant"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Unable to remove participant</h3>
            <p>
              {removeBlockedHint ||
                "This participant still has related expenses. Resolve those first."}
            </p>
            {removeBlockedName ? (
              <p className={styles.dialogHint}>{removeBlockedName}</p>
            ) : null}
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setRemoveBlockedDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setRemoveBlockedDialogOpen(false);
                  onOpenExpenses();
                }}
              >
                View related expenses
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {transferConfirmOpen && ownershipTransferPlan?.valid ? (
        <div
          className={styles.overlay}
          role="presentation"
          onClick={() => setTransferConfirmOpen(false)}
        >
          <section
            className={`${styles.dialog} ${styles.transferDialog}`}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm ownership transfer"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Transfer ownership to {ownershipTransferPlan.targetName}?</h3>
            <p>
              You will become {roleLabel(ownershipTransferPlan.nextSelfRole)}{" "}
              after transfer.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setTransferConfirmOpen(false)}
                disabled={roleSaveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.transferConfirmButton}
                onClick={() => void executeSaveRoles()}
                disabled={roleSaveLoading}
              >
                {roleSaveLoading ? "Saving..." : "Confirm transfer"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
};
