# ask.py — Invoca el OrchestratorAgent y muestra la respuesta formateada
import subprocess
import json
import sys

def ask(prompt: str):
    print(f"\n{'='*60}")
    print(f"Pregunta: {prompt}")
    print('='*60)

    result = subprocess.run(
        f'agentcore invoke --runtime OrchestratorAgent --stream --prompt "{prompt}"',
        capture_output=True,
        text=True,
        encoding="utf-8",
        shell=True,
        cwd="."
    )

    for line in result.stdout.splitlines():
        if line.startswith("data:"):
            try:
                data = json.loads(line[5:].strip())
                text = data.get("text", "")
                # Limpiar el bloque <thinking>...</thinking>
                import re
                text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL).strip()
                print(text)
            except Exception:
                pass

if __name__ == "__main__":
    if len(sys.argv) > 1:
        ask(" ".join(sys.argv[1:]))
    else:
        ask("Busca vuelos de Bogota a Miami para el 10 de marzo de 2027 y dime el clima")
