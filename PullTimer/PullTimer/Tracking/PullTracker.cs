using System;
using System.Collections.Generic;
using System.Numerics;
using Dalamud.Game.ClientState.Conditions;
using Dalamud.Game.ClientState.Objects.Enums;
using Dalamud.Game.ClientState.Objects.Types;
using Dalamud.Hooking;
using Dalamud.Plugin.Services;
using FFXIVClientStructs.FFXIV.Client.Game.Character;
using FFXIVClientStructs.FFXIV.Client.UI.Agent;
using CSCharacter = FFXIVClientStructs.FFXIV.Client.Game.Character.Character;
using GameObjectId = FFXIVClientStructs.FFXIV.Client.Game.Object.GameObjectId;

namespace PullTimer.Tracking;

/// <summary>
/// Follows the countdown agent every frame and watches incoming action effects to work out
/// who pulled, when the enemy got hit, and how that compares to countdown zero.
/// </summary>
public sealed unsafe class PullTracker : IDisposable
{
    // A countdown that stops within this many seconds of zero counts as finished, not cancelled.
    private const double ZeroSlack = 0.25;
    // After a countdown stops early, how long an (early) pull may still arrive before we call it cancelled.
    private const double CancelGrace = 1.5;
    // If combat starts before we see any party action, an action this soon after still names the puller.
    private const double AttributionGrace = 0.75;
    // For body pulls, wait this long before announcing so attribution can settle.
    private const double AnnounceDelay = 0.8;
    // Give up waiting for a hit to land after this long (missed, target died, packet never matched).
    private const double LandTimeout = 3.0;
    private const int MaxOwnActions = 24;

    private readonly Configuration config;
    private readonly Hook<ActionEffectHandler.Delegates.Receive> receiveHook;
    private readonly List<PendingLanding> pendingLandings = [];

    private float lastRemaining;
    private double initialZero;
    private bool wasActive;
    private bool wasInCombat;
    private uint lastTerritory;

    public PullSession? Current { get; private set; }
    public double LastCompletedAt { get; private set; } = double.NegativeInfinity;

    /// <summary>Fired once the pulling hit has landed, with a snapshot of what is known so far.</summary>
    public event Action<PullRecord>? PullAnnounced;
    /// <summary>Fired once your own first hit has landed (and the pull was already announced), unless you pulled.</summary>
    public event Action<PullRecord>? OwnFirstHit;
    /// <summary>Fired when the party window closes and the record is final.</summary>
    public event Action<PullRecord>? Completed;

    public PullTracker(Configuration config)
    {
        this.config = config;
        lastTerritory = Plugin.ClientState.TerritoryType;

        receiveHook = Plugin.GameInterop.HookFromAddress<ActionEffectHandler.Delegates.Receive>(
            ActionEffectHandler.Addresses.Receive.Value, ReceiveDetour);
        receiveHook.Enable();

        Plugin.Framework.Update += OnUpdate;
    }

    public void Dispose()
    {
        Plugin.Framework.Update -= OnUpdate;
        receiveHook.Dispose();
    }

    private void OnUpdate(IFramework framework)
    {
        try
        {
            Tick(Clock.Now);
        }
        catch (Exception ex)
        {
            Plugin.Log.Error(ex, "Pull tracker update failed");
            Drop();
        }
    }

    private void Tick(double now)
    {
        var territory = Plugin.ClientState.TerritoryType;
        if (territory != lastTerritory)
        {
            lastTerritory = territory;
            Drop();
        }

        UpdateCountdown(now);
        UpdateCombat(now);

        if (Current is { } session)
        {
            PollCasts(session, now);
            PollLandings(session, now);
            Advance(session, now);
        }
    }

    private void Drop()
    {
        Current = null;
        pendingLandings.Clear();
    }

    private void UpdateCountdown(double now)
    {
        var agent = AgentCountDownSettingDialog.Instance();
        if (agent == null)
            return;

        var active = agent->Active;
        var remaining = agent->TimeRemaining;

        // A countdown is new when the agent turns active, or the remaining time jumps up (restarted).
        var started = active && (!wasActive || remaining > lastRemaining + 0.5f);
        wasActive = active;

        if (!active)
        {
            if (Current is { CountdownRunning: true } stopped)
            {
                var reachedZero = lastRemaining <= ZeroSlack || now >= stopped.ExpectedZero - ZeroSlack;
                StopCountdown(stopped, now, reachedZero);
            }

            return;
        }

        if (started && remaining > 0)
            StartSession(now, remaining, agent->InitiatorId);

        lastRemaining = remaining;

        if (Current is not { CountdownRunning: true } session)
            return;

        if (remaining > 0)
            session.ExpectedZero = now + remaining;
        else
            StopCountdown(session, now, reachedZero: true);
    }

    private void StartSession(double now, float remaining, uint initiatorId)
    {
        if (Current is { EngagedAt: not null } previous)
            Complete(previous);

        Drop();
        if (config.OnlyInDuties && !Plugin.Condition[ConditionFlag.BoundByDuty])
            return;

        Current = new PullSession
        {
            StartedLocal = DateTime.Now,
            StartedAt = now,
            CountdownSeconds = (int)Math.Ceiling(remaining - 0.05f),
            Duty = GameNames.CurrentDuty(),
            StartedBy = Plugin.ObjectTable.SearchByEntityId(initiatorId)?.Name.TextValue,
            ExpectedZero = now + remaining,
        };
        initialZero = Current.ExpectedZero;
        Plugin.Log.Information($"Countdown started: {remaining:0.000}s by {Current.StartedBy ?? "?"} in {Current.Duty}");
    }

    private void StopCountdown(PullSession session, double now, bool reachedZero)
    {
        session.CountdownRunning = false;
        session.StoppedAt = now;
        session.ReachedZero = reachedZero;

        // Drift between the first and last zero estimate; stays near 0 when TimeRemaining ticks every frame.
        Plugin.Log.Information($"Countdown stopped: reachedZero={reachedZero}, last remaining {lastRemaining:0.000}s, " +
                               $"zero estimate drift {session.ExpectedZero - initialZero:+0.000;-0.000}s");
    }

    private void UpdateCombat(double now)
    {
        var inCombat = Plugin.Condition[ConditionFlag.InCombat];
        if (inCombat && !wasInCombat && Current is { EngagedAt: null } session && AcceptsPull(session, now))
        {
            session.EngagedAt = now;
            session.Source = PullSource.CombatStart;
        }

        wasInCombat = inCombat;
    }

    /// <summary>Whether a pull happening now still belongs to this countdown.</summary>
    private bool AcceptsPull(PullSession session, double now)
    {
        if (session.CountdownRunning)
            return true;
        if (session.ReachedZero)
            return now <= session.ExpectedZero + config.MaxLateSeconds;
        return now <= session.StoppedAt + CancelGrace;
    }

    private void Advance(PullSession session, double now)
    {
        if (session.EngagedAt is not { } engaged)
        {
            // Cancelled, or finished with nobody pulling in time.
            if (!session.CountdownRunning && !AcceptsPull(session, now))
            {
                Plugin.Log.Information(session.ReachedZero ? "Countdown finished but nobody pulled in time" : "Countdown cancelled");
                Drop();
            }

            return;
        }

        var pullSettled = session.Source == PullSource.CombatStart
            ? now >= engaged + AnnounceDelay
            : session.FirstLandedAt != null || now >= engaged + LandTimeout;

        if (!session.Announced && pullSettled)
        {
            session.Announced = true;
            PullAnnounced?.Invoke(session.ToRecord());
        }

        if (session.Announced && !session.OwnAnnounced && session.You is { WentOffTime: { } wentOff } you
            && (you.LandedTime != null || now >= wentOff + LandTimeout))
        {
            session.OwnAnnounced = true;
            if (session.Puller != you)
                OwnFirstHit?.Invoke(session.ToRecord());
        }

        var pullTime = session.PullTime ?? engaged;
        if (!session.CountdownRunning && pendingLandings.Count == 0
            && now >= Math.Max(pullTime, session.ExpectedZero) + config.PartyWindowSeconds)
            Complete(session);
    }

    private void Complete(PullSession session)
    {
        if (Current == session)
            Drop();

        if (!session.Announced)
        {
            session.Announced = true;
            PullAnnounced?.Invoke(session.ToRecord());
        }

        LastCompletedAt = Clock.Now;
        var record = session.ToRecord();
        Plugin.Log.Information($"Pull complete ({record.Source}, landed={record.PullLanded}): {Timing.Summary(record, config.OnTimeWindow)}");
        Completed?.Invoke(record);
    }

    /// <summary>Remembers when each party member's cast bar started, so a cast that later lands can report it.</summary>
    private void PollCasts(PullSession session, double now)
    {
        if (session.EngagedAt == null && !AcceptsPull(session, now))
            return;

        foreach (var chara in PartyCharacters())
        {
            var member = session.GetOrAdd(chara, IsLocal(chara.EntityId));
            var casting = chara.IsCasting;
            if (casting && (!member.WasCasting || chara.CastActionId != member.PendingCastId))
            {
                member.PendingCastId = chara.CastActionId;
                member.PendingCastStart = now - chara.CurrentCastTime;
                member.PendingCastConsumed = false;
            }

            member.WasCasting = casting;
        }
    }

    /// <summary>
    /// An action that went off against enemies but hasn't hit yet. Each target keeps a short list of incoming
    /// effects; the game flags an entry as confirmed when the server reports the effect applied, and drops it
    /// once it has played out. Either of those is the moment the enemy took the hit.
    /// </summary>
    private sealed class PendingLanding
    {
        public required uint GlobalSequence { get; init; }
        public required uint CasterId { get; init; }
        public required List<uint> Targets { get; init; }
        public required double Deadline { get; init; }
        public MemberTiming? FirstHitOf { get; init; }
        public TimedAction? OwnAction { get; init; }
        public bool Seen { get; set; }
    }

    private void PollLandings(PullSession session, double now)
    {
        for (var i = pendingLandings.Count - 1; i >= 0; i--)
        {
            var pending = pendingLandings[i];
            if (HasLanded(pending))
            {
                OnLanded(session, pending, now);
                pendingLandings.RemoveAt(i);
            }
            else if (now > pending.Deadline)
            {
                Plugin.Log.Debug($"Gave up waiting for seq {pending.GlobalSequence} from {pending.CasterId:X} to land (seen={pending.Seen})");
                pendingLandings.RemoveAt(i);
            }
        }
    }

    private static bool HasLanded(PendingLanding pending)
    {
        var present = false;
        foreach (var targetId in pending.Targets)
        {
            if (Plugin.ObjectTable.SearchByEntityId(targetId) is not IBattleChara target || target.Address == nint.Zero)
                continue;

            var handler = &((BattleChara*)target.Address)->ActionEffectHandler;
            foreach (ref var entry in handler->IncomingEffects)
            {
                if (entry.GlobalSequence != pending.GlobalSequence || entry.Source.ObjectId != pending.CasterId)
                    continue;
                if (entry.TargetConfirmed)
                    return true;
                present = true;
            }
        }

        if (present)
        {
            pending.Seen = true;
            return false;
        }

        // It was waiting on the target last frame and has since been consumed.
        return pending.Seen;
    }

    private static void OnLanded(PullSession session, PendingLanding pending, double now)
    {
        if (pending.OwnAction != null)
            pending.OwnAction.LandedTime = now;

        if (pending.FirstHitOf is not { } member)
            return;

        member.LandedTime = now;
        if (session.Source == PullSource.Action && session.FirstLandedAt == null)
        {
            session.FirstLandedAt = now;
            session.Puller = member;
        }
    }

    private void ReceiveDetour(
        uint casterEntityId,
        CSCharacter* casterPtr,
        Vector3* targetPos,
        ActionEffectHandler.Header* header,
        ActionEffectHandler.TargetEffects* effects,
        GameObjectId* targetEntityIds)
    {
        var now = Clock.Now;
        receiveHook.Original(casterEntityId, casterPtr, targetPos, header, effects, targetEntityIds);

        try
        {
            OnActionEffect(now, casterEntityId, header, targetEntityIds);
        }
        catch (Exception ex)
        {
            Plugin.Log.Error(ex, "Failed to process action effect");
        }
    }

    private void OnActionEffect(double now, uint casterId, ActionEffectHandler.Header* header, GameObjectId* targets)
    {
        if (Current is not { } session || (session.EngagedAt == null && !AcceptsPull(session, now)))
            return;

        var (member, viaPet) = ResolveCaster(session, casterId);
        if (member == null)
            return;

        var actionType = header->ActionType;
        var actionId = header->ActionId;
        var enemies = EnemyTargets(header, targets);
        var hostile = enemies.Count > 0;
        var actionName = GameNames.Action(actionType, actionId);
        if (viaPet)
            actionName += " (pet)";

        double? castStart = null;
        if (!viaPet && !member.PendingCastConsumed && member.PendingCastId == actionId)
        {
            castStart = member.PendingCastStart;
            member.PendingCastConsumed = true;
        }

        TimedAction? own = null;
        if (member.IsYou && !viaPet && session.YourActions.Count < MaxOwnActions && !GameNames.IsAutoAttack(actionType, actionId))
        {
            own = new TimedAction { Name = actionName, Time = now, CastStart = castStart, Hostile = hostile };
            session.YourActions.Add(own);
        }

        if (!hostile)
            return;

        MemberTiming? firstHitOf = null;
        if (member.WentOffTime == null)
        {
            firstHitOf = member;
            member.WentOffTime = now;
            member.FirstAction = actionName;
            member.CastStart = castStart;

            if (session.EngagedAt == null)
            {
                session.EngagedAt = now;
                session.Source = PullSource.Action;
                session.Puller = member;
            }
            else if (session.Source == PullSource.CombatStart && session.Puller == null && now - session.EngagedAt <= AttributionGrace)
            {
                session.Puller = member;
            }
        }

        if (firstHitOf != null || own != null)
        {
            pendingLandings.Add(new PendingLanding
            {
                GlobalSequence = header->GlobalSequence,
                CasterId = casterId,
                Targets = enemies,
                Deadline = now + LandTimeout,
                FirstHitOf = firstHitOf,
                OwnAction = own,
            });
        }
    }

    private static (MemberTiming? Member, bool ViaPet) ResolveCaster(PullSession session, uint casterId)
    {
        if (session.Members.TryGetValue(casterId, out var known))
            return (known, false);

        var caster = Plugin.ObjectTable.SearchByEntityId(casterId);
        if (caster is IBattleChara chara && IsPartyOrSelf(casterId))
            return (session.GetOrAdd(chara, IsLocal(casterId)), false);

        // Pets and other summons: credit the owner.
        if (caster is IBattleNpc { OwnerId: var ownerId } && ownerId != casterId && IsPartyOrSelf(ownerId)
            && Plugin.ObjectTable.SearchByEntityId(ownerId) is IBattleChara owner)
            return (session.GetOrAdd(owner, IsLocal(ownerId)), true);

        return (null, false);
    }

    private static List<uint> EnemyTargets(ActionEffectHandler.Header* header, GameObjectId* targets)
    {
        var enemies = new List<uint>();
        for (var i = 0; i < header->NumTargets; i++)
        {
            var id = targets[i].ObjectId;
            if (IsEnemy(id) && !enemies.Contains(id))
                enemies.Add(id);
        }

        var primary = header->AnimationTargetId.ObjectId;
        if (enemies.Count == 0 && IsEnemy(primary))
            enemies.Add(primary);

        return enemies;
    }

    private static bool IsEnemy(uint entityId) =>
        entityId is not (0 or 0xE0000000)
        && Plugin.ObjectTable.SearchByEntityId(entityId) is IBattleNpc { BattleNpcKind: BattleNpcSubKind.Combatant };

    private static IEnumerable<IBattleChara> PartyCharacters()
    {
        if (Plugin.PartyList.Length == 0)
        {
            if (Plugin.ObjectTable.LocalPlayer is { } local)
                yield return local;
            yield break;
        }

        foreach (var member in Plugin.PartyList)
        {
            if (member.GameObject is IBattleChara chara)
                yield return chara;
        }
    }

    private static bool IsPartyOrSelf(uint entityId)
    {
        if (IsLocal(entityId))
            return true;

        foreach (var member in Plugin.PartyList)
        {
            if (member.EntityId == entityId)
                return true;
        }

        return false;
    }

    private static bool IsLocal(uint entityId) => Plugin.ObjectTable.LocalPlayer?.EntityId == entityId;
}
