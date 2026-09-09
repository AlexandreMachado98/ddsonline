import React from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, Sparkles, Scale, Building2, ShieldCheck, 
  AlertTriangle, FileText, Lock, Clock, CheckCircle2, 
  HelpCircle, Ban 
} from 'lucide-react';
import DdsLogo from '@/components/DdsLogo';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso • DDS ON',
  description: 'Termos e Condições Gerais de Uso da Plataforma DDS Online (DDS ON), desenvolvida pela AM TST.'
};

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Barra Superior */}
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

        {/* Cabeçalho */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Scale size={14} /> Contrato de Licenciamento SaaS & Governança SST
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Termos de Uso da Plataforma DDS ON
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Versão Oficial 1.0 • Vigência a partir de Setembro de 2026 • Documento Jurídico Operacional AM TST
          </p>
        </div>

        {/* Quadro Institucional de Identificação */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Building2 size={16} className="text-emerald-400" /> Identificação das Partes Contratantes
          </div>
          <p>
            O presente instrumento estabelece os termos e condições aplicáveis ao uso da plataforma <strong>DDS Online (DDS ON)</strong>, disponibilizada por <strong>AM TST</strong> (Alexandre Machado - Técnico em Segurança do Trabalho).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-800">
            <div>
              <span className="font-semibold text-slate-300">Mantenedor / Licenciante:</span>{' '}
              <span>AM TST (Alexandre Machado)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-300">Contato de Suporte:</span>{' '}
              <a href="mailto:apoioamtst@gmail.com" className="text-emerald-400 underline font-mono">apoioamtst@gmail.com</a>
            </div>
            {/* CAMPOS RESERVADOS PARA PREENCHIMENTO FUTURO:
            <div>
              <span className="font-semibold text-slate-300">CNPJ:</span>{' '}
              <span>[CNPJ DA AM TST]</span>
            </div>
            <div>
              <span className="font-semibold text-slate-300">Foro Eleito:</span>{' '}
              <span>[COMARCA DA SEDE]</span>
            </div>
            */}
          </div>
        </div>

        {/* Conteúdo dos Termos */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-9 text-xs sm:text-sm leading-relaxed text-slate-300">
          
          {/* SEÇÃO 1: OBJETO E ESCOPO */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">1</span>
              Objeto, Escopo e Natureza da Ferramenta
            </h2>
            <p>
              O <strong>DDS Online (DDS ON)</strong> é uma ferramenta de apoio tecnológico disponibilizada como Software as a Service (SaaS), desenhada para digitalização, coleta de assinaturas na tela, anexação de evidências fotográficas e emissão de atas documentais de Diálogos Diários de Segurança (DDS), treinamentos admissionais ou periódicos e alinhamentos de Segurança e Saúde no Trabalho (SST).
            </p>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <p className="font-bold text-white text-xs flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" /> Escopo Estrito de Apoio Tecnológico:
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                A plataforma <strong>atua exclusivamente como facilitadora instrumental e tecnológica</strong>. O uso da plataforma não substitui a efetiva realização pedagógica do diálogo com os trabalhadores, não supre a necessidade de inspeções de campo, não elabora automaticamente laudos periciais ou programas de SST (PGR, PCMSO, LTCAT) e não isenta o empregador do estrito cumprimento de todas as obrigações previstas na Consolidação das Leis do Trabalho (CLT) e nas Normas Regulamentadoras (NRs) do Ministério do Trabalho e Emprego (MTE).
              </p>
            </div>
          </section>

          {/* SEÇÃO 2: MATRIZ DE RESPONSABILIDADES EQUILIBRADA */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">2</span>
              Divisão de Responsabilidades (Matriz RACI)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Building2 size={16} /> Empresa Cliente / Organizador (Controlador)
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-1.5 text-xs">
                  <li>Definição do conteúdo programático e pertinência técnica às atividades executadas.</li>
                  <li>Garantia de que o instrutor responsável possui qualificação legal cabível.</li>
                  <li>Veracidade e exatidão dos nomes, cargos e dados declarados na lista.</li>
                  <li>Comunicação prévia e transparente aos trabalhadores sobre a tomada de assinatura e foto de presença para comprovação legal de SST.</li>
                  <li><strong>Download imediato, arquivamento seguro, guarda regulamentar e backup perpétuo do relatório em PDF gerado</strong> para exibição ao Ministério do Trabalho e eSocial.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-teal-400 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Sparkles size={16} /> Plataforma DDS ON / AM TST (Operador)
                </p>
                <ul className="list-disc list-inside text-slate-400 space-y-1.5 text-xs">
                  <li>Manutenção da infraestrutura tecnológica e disponibilidade do serviço.</li>
                  <li>Geração fidedigna da ata em PDF contendo as evidências registradas.</li>
                  <li>Cálculo e vinculação do Resumo Criptográfico SHA-256 no documento final.</li>
                  <li>Implementação de salvaguardas de segurança da informação (senhas criptografadas, TLS 1.3, rate limit de acessos).</li>
                  <li>Execução do processo de retenção e purga transitória em conformidade com a Política de Privacidade.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: RETENÇÃO OPERACIONAL E ISENÇÃO DE CUSTÓDIA DE LONGO PRAZO */}
          <section className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">3</span>
              Retenção Operacional, Purga em Nuvem e Custódia Documental
            </h2>
            <p>
              Em observância às diretrizes de minimização e segurança de dados, o funcionamento da plataforma rege-se pelas seguintes premissas técnicas:
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <p className="font-bold text-white text-xs flex items-center gap-2">
                  <Clock size={15} className="text-amber-400" /> Janela Operacional de 48 Horas
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Os arquivos de evidência física (fotografias e traçados originais de assinatura) permanecem acessíveis no banco de dados temporário por <strong>48 (quarenta e oito) horas</strong> após o encerramento do evento (estado <code>ENDED</code>), intervalo suficiente para que o organizador revise os dados e gere/baixe a ata consolidada em formato PDF.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <p className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-400" /> Responsabilidade Exclusiva de Custódia e Arquivamento pelo Cliente
                </p>
                <p className="text-slate-300 text-xs leading-relaxed">
                  O DDS Online <strong>NÃO opera como repositório documental permanente ou sistema de GED (Gestão Eletrônica de Documentos) de guarda legal perpétua</strong>. A plataforma não assume dever de guarda de longo prazo perante auditorias trabalhistas, previdenciárias ou tributárias (prazos prescricionais de 5 a 20 anos aplicáveis à SST).
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Concluído o download do documento em PDF, <strong>a obrigação de custódia, arquivamento digital, replicação e segurança desse arquivo recai inteira e indelegavelmente sobre a empresa contratante e organizadora do DDS</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-rose-500/30 space-y-2">
                <p className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                  <Ban size={15} className="text-rose-400" /> Impossibilidade Técnica de Reconstituição Após a Purga
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Decorrido o prazo regulamentar de 48 horas ou acionada a purga manual pelo organizador, os arquivos pesados de imagem e assinaturas são permanentemente eliminados da infraestrutura em nuvem, restando preservados no sistema apenas o <strong>Hash SHA-256</strong> e os metadados cadastrais imutáveis para fins de validação pública de integridade. Em caso de perda, não realização do download ou exclusão do PDF pelo cliente após a purga, a plataforma não terá meios técnicos de reconstruir as imagens e assinaturas originais.
                </p>
              </div>
            </div>
          </section>

          {/* SEÇÃO 4: ASSINATURAS ELETRÔNICAS E EVIDÊNCIAS DE CAMPO */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">4</span>
              Validade Jurídica das Assinaturas Eletrônicas Simples
            </h2>
            <p>
              As assinaturas colhidas na plataforma constituem <strong>Assinaturas Eletrônicas Simples</strong> na forma do <strong>Artigo 3º, inciso I da Lei nº 14.063/2020</strong> e do <strong>Artigo 10, § 2º da Medida Provisória nº 2.200-2/2001</strong>.
            </p>
            <p className="text-slate-400 text-xs">
              As partes declaram expressamente que concordam com a utilização do meio eletrônico disponibilizado pela plataforma como comprovação hábil de autoria, integridade e participação no Diálogo Diário de Segurança, dispensando a exigência de certificado digital no padrão da Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil). A integridade do documento consolidado é comprovada mediante o Resumo Criptográfico SHA-256 gerado automaticamente e impresso na folha do relatório.
            </p>
          </section>

          {/* SEÇÃO 5: COMPROVAÇÃO FOTOGRÁFICA E NÃO BIOMETRIA */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">5</span>
              Comprovação Fotográfica Documental (Não Biometria)
            </h2>
            <p>
              O organizador e os participantes declaram ciência de que a fotografia capturada no momento da confirmação de presença serve unicamente como evidência visual e documental de presença física na instrução de segurança. A plataforma não executa algoritmos de reconhecimento facial, comparação automatizada ou biometria algorítmica.
            </p>
          </section>

          {/* SEÇÃO 6: CONDUTAS VEDADAS E USO INDEVIDO */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">6</span>
              Condutas Vedadas e Responsabilidades por Fraude
            </h2>
            <p>
              É expressamente vedado ao usuário e organizador:
            </p>
            <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
              <li>Registrar presença fictícia ou fraudulenta de trabalhadores ausentes;</li>
              <li>Utilizar fotografias falsas, montagens ou assinaturas simuladas sem consentimento do titular;</li>
              <li>Realizar engenharia reversa, descompilação ou ataques cibernéticos contra as APIs e servidores da plataforma;</li>
              <li>Utilizar a plataforma para finalidades ilícitas ou em violação direta às Normas Regulamentadoras do MTE.</li>
            </ul>
            <p className="text-slate-400 text-xs">
              O descumprimento destas diretrizes autoriza o bloqueio cautelar da conta e poderá ensejar a responsabilização civil e criminal do infrator perante as autoridades competentes.
            </p>
          </section>

          {/* SEÇÃO 7: PROPRIEDADE INTELECTUAL */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">7</span>
              Propriedade Intelectual e Direitos Autorais
            </h2>
            <p>
              A marca <strong>DDS ON</strong>, os logotipos, interfaces gráficas, estrutura de banco de dados, rotinas de contingência offline (PWA) e o código-fonte da aplicação pertencem exclusivamente aos seus desenvolvedores sob titularidade de <strong>AM TST</strong>.
            </p>
            <p className="text-slate-400 text-xs">
              Os dados específicos inseridos pela empresa cliente (conteúdo próprio de treinamentos, imagens de temas e listas nominais) são de propriedade da contratante, que outorga à plataforma uma licença de processamento limitada, não exclusiva e temporária, estritamente necessária para a operacionalização dos serviços contratados.
            </p>
          </section>

          {/* SEÇÃO 8: DISPONIBILIDADE E MODO CONTINGENCIAL OFFLINE */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">8</span>
              Disponibilidade e Tolerância a Falhas em Campo
            </h2>
            <p>
              A AM TST envida os melhores esforços técnicos para assegurar uma meta de disponibilidade mensal de 99,5% do serviço. Em razão da natureza das frentes de trabalho de campo (canteiros de obras, operações florestais, áreas industriais remotas), a plataforma fornece arquitetura <strong>Offline-First</strong> via tecnologia PWA. A ausência temporária de sinal de telefonia ou internet no dispositivo do usuário é mitigada pelo armazenamento local temporário, cabendo ao operador sincronizar os dados assim que o enlace de dados for restabelecido.
            </p>
          </section>

          {/* SEÇÃO 9: DISPOSIÇÕES GERAIS, LEI APLICÁVEL E FORO */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">9</span>
              Disposições Gerais, Legislação e Foro
            </h2>
            <p>
              O presente contrato é regido e interpretado pelas leis da República Federativa do Brasil, em particular o Marco Civil da Internet (Lei nº 12.965/2014), a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e a Lei de Assinaturas Eletrônicas (Lei nº 14.063/2020).
            </p>
            <p className="text-slate-400 text-xs">
              Para dirimir quaisquer litígios ou controvérsias oriundas do presente instrumento, as partes elegem o foro da comarca da sede da empresa mantenedora, com expressa renúncia a qualquer outro, por mais privilegiado que seja.
              {/* CAMPO RESERVADO PARA DEFINIÇÃO DA COMARCA: [COMARCA DA SEDE DO MANTENEDOR] */}
            </p>
          </section>

        </div>

        {/* Rodapé da Página */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/60 text-xs text-slate-500">
          <div>
            <p>© 2026 <strong>AM TST</strong>. Todos os direitos reservados.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">DDS ON é uma tecnologia desenvolvida pela AM TST.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacidade" className="text-emerald-400 hover:underline">
              Aviso de Privacidade (LGPD)
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
