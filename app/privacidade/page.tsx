import React from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Lock, Eye, Database, Server, Mail, 
  UserCheck, AlertCircle, ShieldCheck, Clock, FileText, 
  HardDrive, KeyRound, AlertTriangle, CheckCircle2 
} from 'lucide-react';
import DdsLogo from '@/components/DdsLogo';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aviso de Privacidade (LGPD) • DDS ON',
  description: 'Política e Aviso de Privacidade e Tratamento de Dados Pessoais do DDS Online em estrita conformidade com a Lei nº 13.709/2018 (LGPD).'
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Barra Superior de Navegação */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Voltar ao Início
          </Link>
          <DdsLogo size="sm" showSubtitle={false} />
        </div>

        {/* Cabeçalho Principal */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <ShieldCheck size={14} /> Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Aviso de Privacidade & Tratamento de Dados
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Versão Oficial 1.0 • Vigência a partir de Setembro de 2026 • Governança Documental DDS ON / AM TST
          </p>
        </div>

        {/* Quadro Institucional de Identificação */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Building2Icon className="text-emerald-400" /> Identificação do Mantenedor Tecnológico
          </div>
          <p>
            A plataforma <strong>DDS Online (DDS ON)</strong> é desenvolvida e mantida por <strong>AM TST</strong> (Alexandre Machado - Técnico em Segurança do Trabalho).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800">
            <div>
              <span className="font-semibold text-slate-300">CNPJ do Mantenedor:</span>{' '}
              <span className="text-amber-400 font-mono">[PREENCHIMENTO NECESSÁRIO ANTES DA PUBLICAÇÃO: CNPJ da AM TST]</span>
            </div>
            <div>
              <span className="font-semibold text-slate-300">Sede / Endereço:</span>{' '}
              <span className="text-amber-400 font-mono">[PREENCHIMENTO NECESSÁRIO ANTES DA PUBLICAÇÃO: Endereço da Sede]</span>
            </div>
            <div>
              <span className="font-semibold text-slate-300">Canal Oficial DPO / Privacidade:</span>{' '}
              <a href="mailto:apoioamtst@gmail.com" className="text-emerald-400 underline font-mono">apoioamtst@gmail.com</a>
            </div>
            <div>
              <span className="font-semibold text-slate-300">Encarregado de Dados (DPO):</span>{' '}
              <span>Alexandre Machado (AM TST)</span>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-9 text-xs sm:text-sm leading-relaxed text-slate-300">
          
          {/* SEÇÃO 1: PAPÉIS LGPD */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">1</span>
              Quem é Quem no Tratamento de Dados (Papéis LGPD)
            </h2>
            <p>
              Nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD), a relação de governança de dados da plataforma é estruturada com clareza em duas frentes distintas:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5 text-xs sm:text-sm">
                  <UserCheck size={16} className="text-emerald-400" /> Seu Empregador / Empresa Cliente (Controlador)
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  A empresa ou empregador que contrata o DDS Online ou na qual você trabalha é a <strong>Controladora</strong> exclusiva dos dados pessoais operacionais do DDS. É ela quem decide quais temas ministrar, quais trabalhadores devem comparecer, recolhe as assinaturas e responde pela custódia e apresentação das atas à fiscalização do trabalho.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5 text-xs sm:text-sm">
                  <Server size={16} className="text-teal-400" /> Plataforma DDS ON / AM TST (Operador)
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  A <strong>AM TST</strong> atua como <strong>Operadora</strong> de tecnologia, fornecendo o software SaaS para coleta, processamento, cálculo criptográfico e emissão do relatório em PDF, tratando tais dados operacionais estritamente conforme as instruções da empresa cliente.
                </p>
                <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                  *Para os dados cadastrais da conta do organizador (login, e-mail, senha criptografada e logs de acesso de segurança), a AM TST atua como Controladora direta para prevenção de fraudes e cumprimento do Marco Civil da Internet.
                </p>
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: CATEGORIAS DE DADOS E FINALIDADES */}
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">2</span>
              Categorias de Dados Coletados e Finalidades Operacionais
            </h2>
            <p>
              A plataforma coleta estritamente os dados necessários para a formalização probatória de treinamentos e Diálogos Diários de Segurança do Trabalho:
            </p>

            {/* Subdivisão das 3 Categorias */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <p className="font-bold text-white text-xs flex items-center gap-2">
                  <KeyRound size={15} className="text-emerald-400" /> A. Dados de Conta do Usuário / Organizador
                </p>
                <p className="text-slate-400 text-xs">
                  <strong>Dados:</strong> Nome completo, e-mail corporativo, senha com hash unidirecional (Bcrypt com salteamento forte) e timestamps de login.
                </p>
                <p className="text-slate-400 text-xs">
                  <strong>Finalidade e Base Legal:</strong> Gestão de acesso, autenticação multifatorial/sessão segura e prevenção contra acessos não autorizados (Art. 7º, V e IX da LGPD).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <p className="font-bold text-white text-xs flex items-center gap-2">
                  <FileText size={15} className="text-teal-400" /> B. Dados Operacionais Temporários do DDS
                </p>
                <p className="text-slate-400 text-xs">
                  <strong>Dados:</strong> Tema ministrado, fazenda/obra/setor, objetivo, conteúdo programático, fotografias de presença coletiva, anexos de material de treinamento, e dos participantes: nome completo, cargo/função, fotografia facial simples de comprovação de presença física, traçado vetorial de assinatura digital em tela sensível ao toque, horário de entrada, horário e justificativa de saída antecipada (se houver).
                </p>
                <p className="text-slate-400 text-xs">
                  <strong>Finalidade e Base Legal:</strong> Comprovação da realização do DDS e cumprimento de obrigações legais e regulamentares trabalhistas de SST (Art. 7º, II da LGPD c/c CLT e Normas Regulamentadoras - NR-1, NR-18, NR-31).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <p className="font-bold text-white text-xs flex items-center gap-2">
                  <Database size={15} className="text-cyan-400" /> C. Documento Consolidado (PDF) e Metadados Perpétuos de Integridade
                </p>
                <p className="text-slate-400 text-xs">
                  <strong>Dados:</strong> Arquivo PDF gerado contendo a ata completa assinada, carimbo temporal de encerramento e <strong>Resumo Criptográfico SHA-256 (`documentHash`)</strong>.
                </p>
                <p className="text-slate-400 text-xs">
                  <strong>Finalidade:</strong> Prova documental de integridade e imutabilidade perante auditorias e fiscalizações. Os metadados cadastrais mínimos (ID, tema, data/hora, quantidade de assinaturas e Hash) permanecem preservados no sistema para viabilizar a verificação pública de autenticidade do documento emitido.
                </p>
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: CICLO DE VIDA E POLÍTICA REAL DE RETENÇÃO E PURGA */}
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">3</span>
              Ciclo de Vida dos Dados: Retenção Operacional e Purga em Nuvem
            </h2>
            <p>
              O DDS Online adota o princípio de <strong>Minimização de Dados (Art. 6º, III da LGPD)</strong> e de <strong>Limitação do Armazenamento</strong>. Os dados percorrem o seguinte ciclo técnico:
            </p>

            {/* Fluxo Visual do Ciclo de Vida */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] sm:text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-slate-300">
                <span className="px-2 py-1 bg-slate-900 rounded border border-slate-800">1. Coleta</span>
                <span className="text-emerald-400">→</span>
                <span className="px-2 py-1 bg-slate-900 rounded border border-slate-800">2. Processamento</span>
                <span className="text-emerald-400">→</span>
                <span className="px-2 py-1 bg-slate-900 rounded border border-slate-800">3. Buffer Transitório</span>
                <span className="text-emerald-400">→</span>
                <span className="px-2 py-1 bg-slate-900 rounded border border-slate-800">4. Emissão do PDF</span>
                <span className="text-emerald-400">→</span>
                <span className="px-2 py-1 bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">5. Retenção (48h)</span>
                <span className="text-emerald-400">→</span>
                <span className="px-2 py-1 bg-rose-950/60 border border-rose-500/30 text-rose-300">6. Purga Nuvem</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Clock size={16} className="text-amber-400" /> A Janela de Retenção Operacional de 48 Horas
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Para viabilizar que o instrutor ou administrador conclua o evento, revise os dados e efetue o download do relatório oficial em PDF, todos os dados operacionais e arquivos de mídia (fotos e assinaturas) permanecem disponíveis no banco de dados operacional pelo período padrão de <strong>48 (quarenta e oito) horas</strong> após o encerramento formal da reunião (estado <code>ENDED</code>).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/30 space-y-2">
                <p className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                  <AlertCircle size={16} className="text-rose-400" /> A Rotina Automática de Purga de Dados Pesados
                </p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Decorrido o prazo operacional de 48 horas (ou imediatamente mediante solicitação manual de limpeza efetuada pelo organizador na área administrativa após o download da ata), o sistema executa a rotina de <strong>purga permanente e irreversível dos dados pesados em nuvem</strong>:
                </p>
                <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
                  <li><strong>Arquivos Removidos Definitivamente da Nuvem:</strong> Fotografias coletivas (`groupPhoto`), arquivos anexos de slides/documentos (`fileData`), fotos faciais individuais dos participantes (`selfie`) e os traçados vetoriais originais das assinaturas digitais (`signature`).</li>
                  <li><strong>Registros Preservados para Auditoria de Autenticidade:</strong> O ID da reunião, tema, local/empresa, datas/horários, nome do instrutor, classificação, dados cadastrais básicos da presença (nome completo, cargo e horários) e o <strong>Hash Criptográfico SHA-256</strong>. Isso permite que, a qualquer tempo, quem possuir o PDF emitido possa conferir no validador público da plataforma se aquele documento é autêntico e inalterado.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <p className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-400" /> Não Manutenção de Repositório Permanente (Guarda a Cargo do Cliente)
                </p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  A plataforma <strong>DDS Online atua estritamente como ferramenta tecnológica de coleta, certificação e emissão de atas em PDF</strong>. A plataforma <strong>não atua como repositório documental permanente (GED regulatório)</strong>. Uma vez expirado o prazo de 48 horas e realizada a purga, a plataforma <strong>não possui capacidade técnica de reconstituir ou restaurar as fotos e assinaturas originais</strong> caso o cliente não tenha realizado o download do PDF. A custódia, arquivamento de longo prazo (prazos trabalhistas e previdenciários de 5, 20 anos ou mais) e backup são de responsabilidade integral e exclusiva da empresa cliente.
                </p>
              </div>
            </div>
          </section>

          {/* SEÇÃO 4: CLARIFICAÇÃO TÉCNICA - FOTOGRAFIA NÃO BIOMÉTRICA */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">4</span>
              Clarificação Técnica: Fotografia Simples de Presença (Não Biometria)
            </h2>
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/20 space-y-2">
              <p className="text-slate-300">
                A fotografia capturada individualmente ou em grupo na plataforma serve <strong>estritamente como evidência fotográfica documental de presença física</strong> do colaborador no treinamento de segurança.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                A plataforma DDS Online <strong>NÃO realiza reconhecimento facial automatizado, NÃO extrai vetores biométricos matemáticos, NÃO faz mapeamento de marcos anatômicos ou pontos nodais, e NÃO executa comparações biométricas de identificação 1:1 ou 1:N</strong>. Trata-se de uma imagem fotográfica documental simples para comprovação de presença, dispensando o enquadramento de tratamento biométrico automatizado nos termos da Resolução CD/ANPD nº 4/2023.
              </p>
            </div>
          </section>

          {/* SEÇÃO 5: ASSINATURAS ELETRÔNICAS SIMPLES */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">5</span>
              Natureza Jurídica das Assinaturas Eletrônicas Coletadas
            </h2>
            <p>
              As assinaturas registradas em tela sensível ao toque ou dispositivo apontador enquadram-se como <strong>Assinaturas Eletrônicas Simples</strong>, consoante o disposto no <strong>Artigo 3º, inciso I da Lei Federal nº 14.063/2020</strong> e no <strong>Artigo 10, § 2º da Medida Provisória nº 2.200-2/2001</strong>.
            </p>
            <p className="text-slate-400 text-xs">
              A plataforma <strong>não utiliza certificados digitais emitidos pela cadeia ICP-Brasil</strong> para os colaboradores participantes. A autenticidade, autoria e integridade probatória são asseguradas pela combinação lógica do traçado gráfico, fotografia de presença física simultânea, registro de endereço IP, carimbo de data e hora do servidor sincronizado via NTP, e pelo Hash SHA-256 gravado na ata no momento do fechamento.
            </p>
          </section>

          {/* SEÇÃO 6: COOKIES E ARMAZENAMENTO LOCAL (OFFLINE FIRST) */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">6</span>
              Cookies e Armazenamento Local no Dispositivo (Modo PWA Offline)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Lock size={15} className="text-emerald-400" /> Cookie de Sessão HttpOnly
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Utilizamos exclusivamente cookies estritamente necessários para autenticação e segurança. O cookie <code>dds_session</code> armazena uma credencial criptográfica assinada via HMAC-SHA256 (com atributos <code>HttpOnly</code>, <code>SameSite=Lax</code> e <code>Secure</code> em ambiente de produção), protegida contra ataques XSS. <strong>Não utilizamos cookies de terceiros para publicidade, rastreamento ou criação de perfis comerciais.</strong>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <p className="font-bold text-white text-xs flex items-center gap-1.5">
                  <HardDrive size={15} className="text-teal-400" /> Armazenamento Local Offline (IndexedDB)
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Para permitir o registro de treinamentos em locais remotos (frentes de obra, áreas rurais e subsolos sem sinal de internet), o aplicativo armazena temporariamente no navegador do próprio operador (IndexedDB e LocalStorage) os rascunhos de reuniões e presenças pendentes. Tais dados ficam retidos no hardware do usuário até a sincronização bem-sucedida ou descarte voluntário.
                </p>
              </div>
            </div>
          </section>

          {/* SEÇÃO 7: FORNECEDORES DE INFRAESTRUTURA E SUBPROCESSADORES */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">7</span>
              Fornecedores de Infraestrutura e Subprocessadores Tecnológicos
            </h2>
            <p>
              Para assegurar alta disponibilidade e resiliência, a AM TST contrata exclusivamente provedores de infraestrutura que atendem a rigorosos padrões internacionais de segurança (como SOC 2 Tipo II e ISO 27001):
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border border-slate-800 rounded-2xl overflow-hidden">
                <thead className="bg-slate-950 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 border-b border-slate-800">Provedor / Tecnologia</th>
                    <th className="p-3 border-b border-slate-800">Função Operacional</th>
                    <th className="p-3 border-b border-slate-800">Segurança Aplicada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  <tr>
                    <td className="p-3 font-semibold text-white">Vercel Inc.</td>
                    <td className="p-3 text-slate-400">Hospedagem, borda (Edge Network) e entrega via CDN.</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">TLS 1.3, HSTS e Proteção DDoS</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">PostgreSQL Gerenciado em Nuvem</td>
                    <td className="p-3 text-slate-400">Banco de dados relacional para persistência transitória.</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">SSL obrigatório e repouso AES-256</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Servidores PeerJS / Google STUN</td>
                    <td className="p-3 text-slate-400">Sinalização de áudio/vídeo WebRTC para reuniões remotas.</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">Conexão P2P ponta-a-ponta (sem gravação)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* SEÇÃO 8: SEGURANÇA DA INFORMAÇÃO */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">8</span>
              Medidas de Segurança da Informação Implementadas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white text-xs flex items-center gap-1">
                  <Lock size={14} className="text-emerald-400" /> Criptografia de Ponta a Ponta
                </p>
                <p className="text-[11px] text-slate-400">Tráfego protegido com protocolo TLS 1.3 obrigatório e senhas com Bcrypt de 10 rounds.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white text-xs flex items-center gap-1">
                  <Database size={14} className="text-emerald-400" /> Resumo SHA-256 Imutável
                </p>
                <p className="text-[11px] text-slate-400">Hash criptográfico calculado no fechamento da ata, garantindo a prova matemática de não adulteração.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white text-xs flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-400" /> Proteção contra Força Bruta
                </p>
                <p className="text-[11px] text-slate-400">Limitação estrita de tentativas consecutivas de login (Rate Limiting de 5 tentativas a cada 15 minutos).</p>
              </div>
            </div>
          </section>

          {/* SEÇÃO 9: DIREITOS DO TITULAR E CANAL DO DPO */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">9</span>
              Direitos dos Titulares (Artigo 18 da LGPD) e Canal DPO
            </h2>
            <p>
              Na qualidade de titular de dados pessoais, você pode exercer perante o <strong>Controlador (seu Empregador / Empresa Cliente)</strong> seus direitos previstos no Artigo 18 da LGPD (confirmação da existência de tratamento, acesso aos dados, correção de informações incompletas ou errôneas).
            </p>
            <p className="text-slate-400 text-xs">
              Nos casos em que a AM TST atue como Controladora direta ou para esclarecimentos técnicos sobre os mecanismos de segurança da plataforma, o titular ou a empresa cliente poderá contatar diretamente o nosso Encarregado pelo Tratamento de Dados Pessoais (DPO):
            </p>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
              <div className="space-y-1">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Mail size={16} className="text-emerald-400" /> Encarregado de Proteção de Dados (DPO)
                </p>
                <p className="text-slate-400 text-xs">
                  Responsável: <strong>Alexandre Machado</strong> • AM TST
                </p>
                <p className="text-[11px] text-slate-500">
                  Prazo de resposta inicial em conformidade com o prazo legal regulamentar da ANPD.
                </p>
              </div>
              <a
                href="mailto:apoioamtst@gmail.com"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <Mail size={14} /> apoioamtst@gmail.com
              </a>
            </div>
          </section>

          {/* SEÇÃO 10: ALTERAÇÕES NESTA POLÍTICA */}
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">10</span>
              Atualizações e Vigência
            </h2>
            <p className="text-slate-400 text-xs">
              Este Aviso de Privacidade poderá ser atualizado periodicamente para refletir aprimoramentos técnicos de segurança ou adequações regulatórias emitidas pela Autoridade Nacional de Proteção de Dados (ANPD). A data da última versão oficial estará sempre indicada no topo deste documento.
            </p>
          </section>

        </div>

        {/* Rodapé Oficial da Página */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/60 text-xs text-slate-500">
          <div>
            <p>© 2026 <strong>AM TST</strong>. Todos os direitos reservados.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">DDS ON é uma tecnologia desenvolvida pela AM TST.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/termos" className="text-emerald-400 hover:underline">
              Termos de Uso
            </Link>
            <span>•</span>
            <Link href="/" className="text-slate-400 hover:underline">
              Página Inicial
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}

function Building2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}
