import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TeamMember {
  nome: string;
  cargo: string;
  filial: string | null;
  email: string;
}

const equipe: TeamMember[] = [
  { nome: "Altina Clemente", cargo: "Assistente Jurídica", filial: "Matriz DF", email: "altina.clemente@paixaocortes.adv.br" },
  { nome: "Ana Júlia Araújo", cargo: "Assistente Jurídica", filial: "Matriz DF", email: "anajulia.araujo@paixaocortes.adv.br" },
  { nome: "Ana Luiza Ribeiro", cargo: "Advogada", filial: "Matriz DF", email: "analuiza.ribeiro@paixaocortes.adv.br" },
  { nome: "Anna Luiza Brandão", cargo: "Advogada", filial: null, email: "annaluiza.ribeiro@paixaocortes.adv.br" },
  { nome: "Beatriz Anjos", cargo: "Advogada", filial: "Matriz DF", email: "beatriz.anjos@paixaocortes.adv.br" },
  { nome: "Beatriz Costa", cargo: "Advogada", filial: null, email: "beatriz.costa@paixaocortes.adv.br" },
  { nome: "Beatriz Serafim", cargo: "Assistente Jurídica", filial: "Filial GO", email: "beatriz.serafim@paixaocortes.adv.br" },
  { nome: "Bruna Sousa", cargo: "Assistente Jurídica", filial: "Matriz DF", email: "bruna.sousa@paixaocortes.adv.br" },
  { nome: "Cleiton Júnior", cargo: "Advogado", filial: "Filial GO", email: "cleiton.junior@paixaocortes.adv.br" },
  { nome: "Daiane Souza", cargo: "Assistente Jurídica", filial: "Matriz DF", email: "daiane.souza@paixaocortes.adv.br" },
  { nome: "Daniela Hollanda", cargo: "Advogada", filial: "Matriz DF", email: "daniela.hollanda@paixaocortes.adv.br" },
  { nome: "Davis Costa", cargo: "Advogado", filial: "Filial GO", email: "davis.costa@paixaocortes.adv.br" },
  { nome: "Felipe Danin", cargo: "Advogado", filial: null, email: "felipe.danin@paixaocortes.adv.br" },
  { nome: "Felipe Leite", cargo: "Advogado", filial: "Filial SP", email: "felipe.leite@paixaocortes.adv.br" },
  { nome: "Fernanda Sousa", cargo: "Advogada", filial: "Filial GO", email: "fernanda.sousa@paixaocortes.adv.br" },
  { nome: "Gabriela Rosa", cargo: "Advogada", filial: "Filial GO", email: "gabriela.rosa@paixaocortes.adv.br" },
  { nome: "Gabrielly Garcias", cargo: "Assistente Jurídica", filial: "Filial GO", email: "gabrielly.garcias@paixaocortes.adv.br" },
  { nome: "Geovana Araújo", cargo: "Assistente Jurídica", filial: "Filial GO", email: "geovana.araujo@paixaocortes.adv.br" },
  { nome: "Giovanna Campana", cargo: "Advogada", filial: "Matriz DF", email: "giovanna.campana@paixaocortes.adv.br" },
  { nome: "Giovanni Castiglioni", cargo: "Advogado", filial: "Matriz DF", email: "giovanni.castiglioni@paixaocortes.adv.br" },
  { nome: "Gisele Santos", cargo: "Advogada", filial: "Filial GO", email: "gisele.santos@paixaocortes.adv.br" },
  { nome: "Isabela Constantino", cargo: "Advogada", filial: "Filial GO", email: "isabela.nogueira@paixaocortes.adv.br" },
  { nome: "Isabela Ribeiro", cargo: "Advogada", filial: "Matriz DF", email: "isabela.ribeiro@paixaocortes.adv.br" },
  { nome: "Janaina Catunda", cargo: "Advogada", filial: null, email: "janaina.catunda@paixaocortes.adv.br" },
  { nome: "Jhonatan Gonçalves", cargo: "Advogado", filial: null, email: "jhonatan.goncalves@paixaocortes.adv.br" },
  { nome: "João Guilherme", cargo: "Assistente Jurídico", filial: "Matriz DF", email: "joao.guilherme@paixaocortes.adv.br" },
  { nome: "João Paulo de Carvalho", cargo: "Advogado", filial: null, email: "joaopaulo@paixaocortes.adv.br" },
  { nome: "José Ermínio Neto", cargo: "Advogado", filial: "Filial GO", email: "jose.erminio@paixaocortes.adv.br" },
  { nome: "Júlia Macri", cargo: "Assistente Jurídica", filial: "Filial GO", email: "julia.macri@paixaocortes.adv.br" },
  { nome: "Júlia Rocha", cargo: "Assistente Jurídica", filial: "Matriz DF", email: "julia.rocha@paixaocortes.adv.br" },
  { nome: "Juliana Paulino", cargo: "Assistente Jurídica", filial: "Filial GO", email: "juliana.paulino@paixaocortes.adv.br" },
  { nome: "Kellen Ferreira", cargo: "Advogada", filial: "Matriz DF", email: "kellen.ferreira@paixaocortes.adv.br" },
  { nome: "Larissa Martins", cargo: "Advogada", filial: "Matriz DF", email: "larissa.martins@paixaocortes.adv.br" },
  { nome: "Leandro Artiaga", cargo: "Advogado", filial: null, email: "leandro.artiaga@paixaocortes.adv.br" },
  { nome: "Lídia Araújo", cargo: "Advogada", filial: "Filial GO", email: "lidia.araujo@paixaocortes.adv.br" },
  { nome: "Lidiane Araújo", cargo: "Advogada", filial: "Filial GO", email: "lidiane.araujo@paixaocortes.adv.br" },
  { nome: "Lienne Vasconcelos", cargo: "Advogada", filial: "Matriz DF", email: "lienne.vasconcelos@paixaocortes.adv.br" },
  { nome: "Lis Ribeiro", cargo: "Advogada", filial: "Filial GO", email: "lis.ribeiro@paixaocortes.adv.br" },
  { nome: "Loren Barbosa", cargo: "Assistente Jurídica", filial: "Matriz DF", email: "loren.barbosa@paixaocortes.adv.br" },
  { nome: "Lucas Calabria", cargo: "Advogado", filial: "Matriz DF", email: "lucas.calabria@paixaocortes.adv.br" },
  { nome: "Lucas Carreiro", cargo: "Advogado", filial: "Matriz DF", email: "lucas.carreiro@paixaocortes.adv.br" },
  { nome: "Lucas Delezuk", cargo: "Advogado", filial: "Matriz DF", email: "lucas.delezuk@paixaocortes.adv.br" },
  { nome: "Luciane Ayres", cargo: "Advogada", filial: null, email: "luciane.ayres@paixaocortes.adv.br" },
  { nome: "Marcela Tavares", cargo: "Advogada", filial: "Filial GO", email: "marcela.tavares@paixaocortes.adv.br" },
  { nome: "Marcelo Chaves", cargo: "Assistente Jurídico", filial: "Matriz DF", email: "marcelo.chaves@paixaocortes.adv.br" },
  { nome: "Maria Luiza Vieira", cargo: "Advogada", filial: "Matriz DF", email: "maria.luiza@paixaocortes.adv.br" },
  { nome: "Narjara Batista", cargo: "Advogada", filial: "Filial GO", email: "narjara.batista@paixaocortes.adv.br" },
  { nome: "Natália Bueno", cargo: "Advogada", filial: "Matriz DF", email: "natalia.bueno@paixaocortes.adv.br" },
  { nome: "Paula Brunna", cargo: "Advogada", filial: "Matriz DF", email: "paula.brunna@paixaocortes.adv.br" },
  { nome: "Paulo Melgaço", cargo: "Assistente Jurídico", filial: "Matriz DF", email: "paulo.melgaco@paixaocortes.adv.br" },
  { nome: "Phelipe Sampaio", cargo: "Advogado", filial: "Matriz DF", email: "phelipe.sampaio@paixaocortes.adv.br" },
  { nome: "Polyana Nava", cargo: "Advogada", filial: "Matriz DF", email: "polyana.nava@paixaocortes.adv.br" },
  { nome: "Priscila Brandt", cargo: "Advogada", filial: null, email: "priscila.brandt@paixaocortes.adv.br" },
  { nome: "Priscila Martins", cargo: "Advogada", filial: "Matriz DF", email: "priscila.martins@paixaocortes.adv.br" },
  { nome: "Raphaela Figueiredo", cargo: "Assistente Jurídica", filial: "Matriz DF", email: "raphaela.figueiredo@paixaocortes.adv.br" },
  { nome: "Renata Aguiar", cargo: "Advogada", filial: "Matriz DF", email: "renata.aguiar@paixaocortes.adv.br" },
  { nome: "Saulo Leal", cargo: "Advogado", filial: "Filial SP", email: "saulo.leal@paixaocortes.adv.br" },
  { nome: "Taís Souza", cargo: "Advogada", filial: null, email: "tais.souza@paixaocortes.adv.br" },
  { nome: "Talles Caetano", cargo: "Assistente Jurídico", filial: "Filial GO", email: "talles.caetano@paixaocortes.adv.br" },
  { nome: "Tatiana Hollanda", cargo: "Advogada", filial: "Matriz DF", email: "tatiana.hollanda@paixaocortes.adv.br" },
  { nome: "Thiago Almeida", cargo: "Advogado", filial: "Filial GO", email: "thiago.almeida@paixaocortes.adv.br" },
  { nome: "Thomás Rieth", cargo: "Advogado", filial: null, email: "thomas.rieth@paixaocortes.adv.br" },
  { nome: "Vanessa Ferreira", cargo: "Advogada", filial: "Filial GO", email: "vanessa.ferreira@paixaocortes.adv.br" },
  { nome: "Vanessa Gomes", cargo: "Advogada", filial: null, email: "vanessa.gomes@paixaocortes.adv.br" },
  { nome: "Verônica Fonseca", cargo: "Advogada", filial: null, email: "veronica.fonseca@paixaocortes.adv.br" },
  { nome: "Victórya Gadelha", cargo: "Advogada", filial: "Matriz DF", email: "victorya.gadelha@paixaocortes.adv.br" },
  { nome: "Vitor Gomes", cargo: "Advogado", filial: "Matriz DF", email: "vitor.gomes@paixaocortes.adv.br" },
];

function getRole(cargo: string): string {
  const cargoLower = cargo.toLowerCase();
  if (cargoLower.includes('assistente')) return 'assistente';
  if (cargoLower.includes('advogad')) return 'advogado';
  if (cargoLower.includes('estagiári') || cargoLower.includes('estagiario')) return 'estagiario';
  if (cargoLower.includes('secretári') || cargoLower.includes('secretaria')) return 'secretaria';
  return 'advogado'; // default
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const password = '@Juriscontrol1500';
    const results: { success: string[]; errors: { email: string; error: string }[] } = {
      success: [],
      errors: []
    };

    console.log(`Starting to create ${equipe.length} users...`);

    for (const member of equipe) {
      try {
        console.log(`Creating user: ${member.email}`);
        
        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: member.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            nome: member.nome
          }
        });

        if (authError) {
          // Check if user already exists
          if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
            console.log(`User ${member.email} already exists, updating profile...`);
            
            // Get existing user
            const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(u => u.email === member.email);
            
            if (existingUser) {
              // Update profile with filial
              const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ 
                  nome: member.nome,
                  filial: member.filial 
                })
                .eq('id', existingUser.id);
              
              if (updateError) {
                console.error(`Error updating profile for ${member.email}:`, updateError);
              } else {
                results.success.push(`${member.email} (updated)`);
              }
            }
            continue;
          }
          
          console.error(`Error creating auth user ${member.email}:`, authError);
          results.errors.push({ email: member.email, error: authError.message });
          continue;
        }

        if (!authData.user) {
          results.errors.push({ email: member.email, error: 'No user returned' });
          continue;
        }

        const userId = authData.user.id;
        
        // Update profile with filial (profile is created by trigger)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            nome: member.nome,
            filial: member.filial 
          })
          .eq('id', userId);

        if (profileError) {
          console.error(`Error updating profile for ${member.email}:`, profileError);
        }

        // Update user role
        const role = getRole(member.cargo);
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);

        if (roleError) {
          console.error(`Error updating role for ${member.email}:`, roleError);
        }

        results.success.push(member.email);
        console.log(`Successfully created user: ${member.email} with role: ${role}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error(`Exception for ${member.email}:`, err);
        results.errors.push({ email: member.email, error: String(err) });
      }
    }

    console.log(`Completed. Success: ${results.success.length}, Errors: ${results.errors.length}`);

    return new Response(
      JSON.stringify({
        message: `Processamento concluído`,
        total: equipe.length,
        created: results.success.length,
        errors: results.errors.length,
        details: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
