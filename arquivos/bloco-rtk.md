
### Saída de shell compacta (rtk)
- Prefixe os comandos de shell com `rtk` (ex.: `rtk git status`, `rtk npm test`, `rtk pytest -q`): ele filtra a saída e economiza 60–90% dos tokens.
- Se a saída parecer filtrada demais, rode de novo com `rtk proxy <comando>` (sem filtro).
