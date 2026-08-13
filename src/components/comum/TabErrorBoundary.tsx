import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Nome amigável da área (ex.: "Atividades") usado na mensagem */
  area?: string;
}

interface State {
  erro: Error | null;
}

/**
 * Evita que uma falha isolada (permissão, dado inesperado) deixe a aba
 * completamente em branco. Mostra a mensagem real para facilitar o suporte.
 */
export class TabErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("[TabErrorBoundary]", this.props.area, erro, info.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Não foi possível carregar {this.props.area ?? "esta aba"}.
          </p>
          <p className="text-muted-foreground break-words">{this.state.erro.message}</p>
          <button
            type="button"
            className="underline text-muted-foreground hover:text-foreground"
            onClick={() => this.setState({ erro: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}