"""
Vocabulario de una sola fuente de verdad para Export. Mismo criterio que
lab.assembly.constants: EXPORT_STATUS viene directo de lo pedido para esta
etapa (DRAFT/READY_FOR_REVIEW/EXPORTED -- deliberadamente sin APPROVED/
REJECTED, a diferencia de Sequence/Narrative/Audio/Render/Assembly: Export
no tiene su propio gate de aprobacion/rechazo, la revision humana real
ocurre fuera de LAB al decidir si importar o no el paquete ya exportado).

Contrato versionado (SCHEMA_VERSION) para que un futuro importer pueda
saber que forma esperar de export_manifest.json sin adivinar.
"""

# Deliberadamente 3 estados, no 4 -- ver docstring del modulo.
EXPORT_STATUS = frozenset({"DRAFT", "READY_FOR_REVIEW", "EXPORTED"})

# Como queda cada elemento del paquete (artifact/asset/render/final_reel)
# en el manifest -- pedido explicito del diseño de esta etapa.
AVAILABILITY = frozenset({"PRESENT", "MISSING", "PENDING", "BLOCKED"})

# Version del CONTRATO de export_manifest.json -- no de LAB ni de la
# historia. Un futuro importer la lee para saber que forma esperar. Semver
# simple: cambia si el schema del manifest cambia de forma incompatible.
SCHEMA_VERSION = "1.0.0"

# Filenames que jamas deben aparecer en un paquete exportado -- chequeo
# defensivo (belt-and-suspenders): Export solo incluye una lista fija y
# nombrada de artifacts/assets/videos conocidos (nunca un glob de
# directorio), asi que estos nombres no deberian poder colarse nunca --
# pero se verifica explicitamente antes de cerrar cualquier export.
FORBIDDEN_FILENAMES = frozenset({".env", ".env.local", ".env.production"})

# Subcadenas (case-insensitive) que, si aparecen en el NOMBRE de un archivo
# a incluir, bloquean el export -- señal de que algo que no debería estar
# en un paquete de contenido se coló ahí (defensa en profundidad, no
# reemplaza el whitelist de inclusión).
FORBIDDEN_FILENAME_SUBSTRINGS = ("apikey", "api_key", "token", "password", "secret", "credential")
