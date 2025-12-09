import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(200),
  tipo: z.enum(["pessoa_fisica", "pessoa_juridica"]),
  cpf_cnpj: z.string().max(20).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().max(20).optional(),
  endereco: z.string().max(500).optional(),
  observacoes: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: any;
}

// Format CPF: 000.000.000-00
const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

// Format CNPJ: 00.000.000/0000-00
const formatCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, "").slice(0, 14);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
};

// Format phone: (00) 00000-0000
const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  if (numbers.length <= 2) return numbers.length ? `(${numbers}` : "";
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
};

export function ClienteDialog({ open, onOpenChange, cliente }: ClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!cliente;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      tipo: "pessoa_fisica",
      cpf_cnpj: "",
      email: "",
      telefone: "",
      endereco: "",
      observacoes: "",
    },
  });

  const tipoCliente = form.watch("tipo");

  useEffect(() => {
    if (open) {
      if (cliente) {
        form.reset({
          nome: cliente.nome || "",
          tipo: cliente.tipo || "pessoa_fisica",
          cpf_cnpj: cliente.cpf_cnpj || "",
          email: cliente.email || "",
          telefone: cliente.telefone || "",
          endereco: cliente.endereco || "",
          observacoes: cliente.observacoes || "",
        });
      } else {
        form.reset({
          nome: "",
          tipo: "pessoa_fisica",
          cpf_cnpj: "",
          email: "",
          telefone: "",
          endereco: "",
          observacoes: "",
        });
      }
    }
  }, [open, cliente, form]);

  const handleCpfCnpjChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    const formatted = tipoCliente === "pessoa_fisica" ? formatCPF(e.target.value) : formatCNPJ(e.target.value);
    onChange(formatted);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
    onChange(formatPhone(e.target.value));
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const clienteData = {
        nome: values.nome.trim(),
        tipo: values.tipo,
        cpf_cnpj: values.cpf_cnpj || null,
        email: values.email || null,
        telefone: values.telefone || null,
        endereco: values.endereco || null,
        observacoes: values.observacoes || null,
      };

      if (isEditing && cliente) {
        const { error } = await supabase
          .from("clientes")
          .update(clienteData)
          .eq("id", cliente.id);

        if (error) throw error;

        toast({
          title: "Cliente atualizado",
          description: "O cliente foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase.from("clientes").insert(clienteData);

        if (error) throw error;

        toast({
          title: "Cliente cadastrado",
          description: "O cliente foi cadastrado com sucesso.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      form.reset();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving cliente:", error);
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: error.message || "Não foi possível salvar o cliente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do cliente conforme necessário."
              : "Preencha as informações do novo cliente."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo ou razão social" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                        <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tipoCliente === "pessoa_fisica" ? "CPF" : "CNPJ"}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={tipoCliente === "pessoa_fisica" ? "000.000.000-00" : "00.000.000/0000-00"}
                        value={field.value}
                        onChange={(e) => handleCpfCnpjChange(e, field.onChange)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={field.value}
                        onChange={(e) => handlePhoneChange(e, field.onChange)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Endereço completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações adicionais..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
