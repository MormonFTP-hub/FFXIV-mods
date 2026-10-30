// Samurai, Dawntrail 7.05–7.57 (js/jobs/sam_dt.js). The Balance's standard play: Meikyo Shisui before the pull,
// Ikishoten and Senei in the burst, every Kaeshi straight after its Iaijutsu, Higanbana kept up, Kenki spent on
// Shinten without starving Senei and Zanshin, Meikyo Shisui whenever the Sen are spent.
BLM.SIM_APLS.sam = `
# Samurai — Dawntrail 7.05–7.57
actions.precombat=meikyoShisui,at=-11

# Abilities, woven between GCDs.
actions=/tincture,if=time<5|cd.ikishoten.remains<3
actions+=/ikishoten,if=time>1
actions+=/zanshin,if=buff.zanshinReady.up&gauge.kenki>=50
actions+=/senei,if=gauge.kenki>=25
actions+=/meikyoShisui,if=!buff.meikyoShisui.up&!buff.tendo.up&job.senCount=0&time>10
actions+=/shoha
actions+=/shinten,if=gauge.kenki>=75|(gauge.kenki>=35&cd.senei.remains>10&!buff.zanshinReady.up)|(cd.ikishoten.remains<6&gauge.kenki>=25)

# Weaponskills.
actions+=/tsubameGaeshi,if=proc.tsubameGaeshi
actions+=/ogiNamikiri,if=gauge.namikiri
actions+=/iaijutsu,if=job.senCount=3
actions+=/higanbana,if=job.senCount=1&debuff.higanbana.remains<5&fight.remains>40
actions+=/gekko,if=buff.meikyoShisui.up&!gauge.sen.getsu
actions+=/kasha,if=buff.meikyoShisui.up&!gauge.sen.ka
actions+=/yukikaze,if=buff.meikyoShisui.up&!gauge.sen.setsu
actions+=/ogiNamikiri,if=usable.ogiNamikiri
actions+=/gekko,if=buff.meikyoShisui.up
actions+=/gekko,if=combo.jinpu
actions+=/kasha,if=combo.shifu
actions+=/jinpu,if=combo.hakaze&buff.fugetsu.remains<8
actions+=/shifu,if=combo.hakaze&buff.fuka.remains<8
actions+=/yukikaze,if=combo.hakaze&!gauge.sen.setsu
actions+=/jinpu,if=combo.hakaze&!gauge.sen.getsu
actions+=/shifu,if=combo.hakaze&!gauge.sen.ka
actions+=/jinpu,if=combo.hakaze
actions+=/hakaze
`;
