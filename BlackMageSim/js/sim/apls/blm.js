// Black Mage, Dawntrail 7.2–7.57 (js/jobs/blm_dt.js, dt72). The Balance's 7.2 loop with elements that never run out:
// Fire III before the pull, High Thunder, Swiftcast and Amplifier, Ley Lines and the tincture early; each Astral
// Fire is Paradox, six Fire IV (three on Umbral Hearts), Flare Star and Despair, with Manafont after Despair whenever
// it's up. Into ice through Transpose and Triplecast (or Swiftcast) for an instant Blizzard III from Umbral Ice I,
// then Blizzard IV; back to fire through Transpose from Umbral Ice III with three hearts, Paradox in Astral Fire I and
// Fire III on its Firestarter (an Xenoglossy or High Thunder in ice covers Transpose's 5s recast). Xenoglossy before a
// fourth Polyglot, High Thunder as the DoT runs out. Moving (style=movement): only instants once a cast couldn't finish.
// Three targets and more: High Blizzard II / Freeze, High Fire II, two Flares into Flare Star, Foul, High Thunder II.
BLM.SIM_APLS.blm = `
# Black Mage — Dawntrail 7.2–7.57
actions.precombat=fire3,at=-3.5

# Abilities, woven after instants (hardcasts leave no room).
actions=/swiftcast,if=time<2
actions+=/amplifier,if=gauge.polyglot<3
actions+=/manafont,if=gauge.element>0&mp<800
# Into ice after Despair. With an instant to spare in ice (Xenoglossy or High Thunder) to cover Transpose's recast:
# Triplecast or Swiftcast, then Transpose, then an instant Blizzard III from Umbral Ice I. Without one: Triplecast
# alone, for an instant Blizzard III and IV so Transpose can be woven after Blizzard IV.
actions+=/variable,name=bridge,value=gauge.polyglot>=1|buff.thunderhead.up&debuff.highThunder.remains<12
actions+=/triplecast,if=targets<3&gauge.element=3&mp<800&!cd.manafont.ready&cd.transpose.ready&!buff.triplecast.up&!buff.swiftcast.up
actions+=/swiftcast,if=targets<3&gauge.element=3&mp<800&!cd.manafont.ready&cd.transpose.ready&!buff.triplecast.up&!buff.swiftcast.up&var.bridge
actions+=/transpose,if=targets<3&gauge.element=3&mp<800&!cd.manafont.ready&(buff.triplecast.up&var.bridge|buff.swiftcast.up)
# Back to fire: Transpose from Umbral Ice III with three hearts (Paradox lit), then Paradox and Fire III below.
actions+=/transpose,if=targets<3&gauge.element=-3&gauge.hearts>=3&gauge.paradox
actions+=/leyLines,if=!buff.leyLines.up&(time>1|cd.leyLines.charges>=2)&!moving
actions+=/tincture,if=(time>1&time<10)|(time%120)<15|fight.remains<31

# Movement: once the next cast couldn't finish before it (slidecasting its last 0.5s), only instants.
actions+=/variable,name=cast,value=action.fire4.cast_time*(gauge.element>0)+action.blizzard4.cast_time*(gauge.element<0)
actions+=/run_action_list,name=move,if=var.cast>0&(moving|movement.in<var.cast-0.45)

# AoE from three targets (Transpose after Flare Star skips High Blizzard II: Freeze from Umbral Ice I gives Umbral Ice III).
actions+=/transpose,if=targets>=3&gauge.element>0&mp<800&!cd.manafont.ready&gauge.soul<6,pre=1
actions+=/run_action_list,name=aoe,if=targets>=3

# Single target.
actions+=/highThunder,if=buff.thunderhead.up&debuff.highThunder.remains<3
actions+=/paradox,if=gauge.element>0&gauge.element<3
actions+=/fire3,if=gauge.element>0&gauge.element<3
actions+=/flareStar,if=gauge.soul>=6
actions+=/xenoglossy,if=gauge.polyglot>=3|fight.remains<gauge.polyglot*gcd+1
actions+=/paradox,if=gauge.element>0&mp>=2400
actions+=/fire4,if=gauge.element>0&mp>=action.fire4.mp+800
actions+=/despair,if=gauge.element>0&mp>=800
actions+=/blizzard3,if=gauge.element>0
actions+=/blizzard3,if=gauge.element<0&gauge.element>-3
actions+=/blizzard4,if=gauge.element<0&gauge.hearts<3
actions+=/xenoglossy,if=gauge.element<0&gauge.paradox&cd.transpose.remains<gcd
actions+=/highThunder,if=gauge.element<0&gauge.paradox&cd.transpose.remains<gcd&buff.thunderhead.up&debuff.highThunder.remains<12
actions+=/fire3,if=gauge.element<0
actions+=/xenoglossy

# Moving: instants first, then Triplecast or Swiftcast for the casts.
actions.move=/foul,if=targets>=3
actions.move+=/highThunder2,if=targets>=3&buff.thunderhead.up
actions.move+=/paradox,if=gauge.element>0&mp>=2400
actions.move+=/xenoglossy
actions.move+=/fire3,if=gauge.element>0&buff.firestarter.up
actions.move+=/highThunder,if=buff.thunderhead.up
actions.move+=/despair,if=gauge.element>0&mp>=800&mp<action.fire4.mp+800
actions.move+=/paradox,if=gauge.element>0
actions.move+=/fire3,if=gauge.element<0&gauge.hearts>=3&buff.firestarter.up
actions.move+=/triplecast,if=!buff.triplecast.up&!buff.swiftcast.up
actions.move+=/swiftcast,if=!buff.triplecast.up&!buff.swiftcast.up

actions.aoe=/highThunder2,if=buff.thunderhead.up&debuff.highThunder2.remains<3
actions.aoe+=/flareStar,if=gauge.soul>=6
actions.aoe+=/foul,if=gauge.polyglot>=3|fight.remains<gauge.polyglot*gcd+1
actions.aoe+=/flare,if=gauge.element>0&mp>=800
actions.aoe+=/highBlizzard2,if=gauge.element>0
actions.aoe+=/freeze,if=gauge.element<0&gauge.hearts<3
actions.aoe+=/highFire2,if=gauge.element<0
actions.aoe+=/foul
`;
