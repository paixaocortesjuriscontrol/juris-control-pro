import { useState, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Send, Bot, User, Loader2, Search, FileText, 
  Plus, Trash2, MessageSquare, Sparkles, History, PanelLeftClose
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversa = {
  id: string;
  titulo: string | null;
  created_at: string;
};

export default function AssistenteJuridico() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [tipo, setTipo] = useState<"pesquisa" | "geracao">("pesquisa");
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadConversas();
    }
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversas = async () => {
    const { data, error } = await supabase
      .from("repositorio_conversas")
      .select("id, titulo, created_at")
      .eq("usuario_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Erro ao carregar conversas:", error);
    } else {
      setConversas(data || []);
    }
  };

  const loadConversa = async (id: string) => {
    const { data, error } = await supabase
      .from("repositorio_mensagens")
      .select("role, content")
      .eq("conversa_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar conversa");
      return;
    }

    setMessages((data || []) as Message[]);
    setConversaId(id);
    setSheetOpen(false);
  };

  const startNewConversa = async () => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("repositorio_conversas")
      .insert({ usuario_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar conversa");
      return null;
    }

    setConversas(prev => [data, ...prev]);
    return data.id;
  };

  const deleteConversa = async (id: string) => {
    const { error } = await supabase
      .from("repositorio_conversas")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir conversa");
      return;
    }

    setConversas(prev => prev.filter(c => c.id !== id));
    if (conversaId === id) {
      setConversaId(null);
      setMessages([]);
    }
  };

  const clearAllConversas = async () => {
    if (!user || conversas.length === 0) return;

    const { error } = await supabase
      .from("repositorio_conversas")
      .delete()
      .eq("usuario_id", user.id);

    if (error) {
      toast.error("Erro ao limpar histórico");
      return;
    }

    setConversas([]);
    setConversaId(null);
    setMessages([]);
    toast.success("Histórico limpo com sucesso");
  };

  const handleNewChat = () => {
    setConversaId(null);
    setMessages([]);
    setInput("");
    setSheetOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      let currentConversaId = conversaId;
      if (!currentConversaId) {
        currentConversaId = await startNewConversa();
        if (!currentConversaId) {
          throw new Error("Falha ao criar conversa");
        }
        setConversaId(currentConversaId);
      }

      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/repositorio-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            messages: [...messages, { role: "user", content: userMessage }],
            conversaId: currentConversaId,
            tipo,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao comunicar com o assistente");
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      loadConversas();

    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sugestoesPesquisa = [
    "Quais modelos de petição inicial temos no repositório?",
    "Buscar jurisprudência sobre danos morais trabalhistas",
    "Quais contratos de locação temos cadastrados?",
  ];

  const sugestoesGeracao = [
    "Gerar uma petição inicial trabalhista para danos morais",
    "Criar um modelo de contestação para ação de cobrança",
    "Elaborar uma procuração ad judicia",
  ];

  return (
    <MainLayout 
      title="Assistente Jurídico IA" 
      subtitle="Pesquise documentos e gere novos com auxílio de IA"
    >
      <Card className="h-[calc(100vh-10rem)] flex flex-col">
        {/* Header com tabs e botão de conversas */}
        <div className="flex items-center justify-between p-4 border-b">
          <Tabs value={tipo} onValueChange={(v) => setTipo(v as "pesquisa" | "geracao")}>
            <TabsList>
              <TabsTrigger value="pesquisa" className="gap-2">
                <Search className="w-4 h-4" />
                Pesquisa
              </TabsTrigger>
              <TabsTrigger value="geracao" className="gap-2">
                <FileText className="w-4 h-4" />
                Geração
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNewChat} className="gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova conversa</span>
            </Button>
            
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <History className="w-4 h-4" />
                  <span className="hidden sm:inline">Conversas</span>
                  {conversas.length > 0 && (
                    <span className="ml-1 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                      {conversas.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 sm:w-96">
                <SheetHeader>
                  <SheetTitle className="flex items-center justify-between">
                    <span>Histórico de Conversas</span>
                    {conversas.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={clearAllConversas}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Limpar
                      </Button>
                    )}
                  </SheetTitle>
                </SheetHeader>
                
                <div className="mt-4">
                  {conversas.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma conversa ainda
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Inicie uma nova conversa com o assistente
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[calc(100vh-10rem)]">
                      <div className="space-y-1 pr-2">
                        {conversas.map((conversa) => (
                          <div
                            key={conversa.id}
                            className={cn(
                              "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                              conversaId === conversa.id 
                                ? "bg-primary/10 text-primary border border-primary/20" 
                                : "hover:bg-muted border border-transparent"
                            )}
                            onClick={() => loadConversa(conversa.id)}
                          >
                            <MessageSquare className="w-4 h-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate font-medium">
                                {conversa.titulo || "Nova conversa"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(conversa.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversa(conversa.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {tipo === "pesquisa" 
                    ? "Pesquise no Repositório" 
                    : "Gere Documentos com IA"}
                </h3>
                <p className="text-sm text-muted-foreground mb-8 max-w-lg">
                  {tipo === "pesquisa"
                    ? "Faça perguntas sobre documentos, jurisprudências, contratos e modelos do escritório."
                    : "Solicite a geração de peças processuais, contratos e outros documentos jurídicos."}
                </p>
                
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                  {(tipo === "pesquisa" ? sugestoesPesquisa : sugestoesGeracao).map((sugestao, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-2 px-3"
                      onClick={() => setInput(sugestao)}
                    >
                      {sugestao}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                    {message.role === "user" && (
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-background">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    tipo === "pesquisa"
                      ? "Faça uma pergunta sobre os documentos do repositório..."
                      : "Descreva o documento que deseja gerar..."
                  }
                  className="min-h-[56px] max-h-32 resize-none rounded-xl"
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleSend} 
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-14 w-14 rounded-xl flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                O assistente utiliza os documentos do repositório como base de conhecimento
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
