import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, Server, Mail, UserCheck, AlertCircle } from 'lucide-react';
import DdsLogo from '@/components/DdsLogo';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aviso de Privacidade (LGPD) • DDS ON',
  description: 'Aviso de Privacidade e Tratamento de Dados Pessoais do DDS Online em conformidade com a Lei nº 13.709/2018 (LGPD).'
};

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Top bar */}
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

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Lock size={14} /> Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Aviso de Privacidade & Proteção de Dados
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Versão 1.0 • Vigência a partir de Setembro de 2026 • Documentação de Conformidade DDS ON
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-8 text-xs sm:text-sm leading-relaxed text-slate-300">
          
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">1</span>
              Quem é Quem no Tratamento de Dados (Papéis LGPD)
            </h2>
            <p>
              Nos termos da Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <UserCheck size={16} className="text-emerald-400" /> Seu Empregador (Controlador)
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  A empresa com a qual você mantém vínculo de trabalho ou prestação de serviços é a <strong>Controladora</strong> dos seus dados pessoais. É ela quem decide sobre a realização do DDS, quem deve participar e gerencia os registros.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Server size={16} className="text-teal-400" /> Plataforma DDS ON (Operador)
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  O <strong>DDS Online</strong> atua na condição de <strong>Operador</strong>, tratando os dados exclusivamente segundo as instruções do Controlador e para viabilizar o registro tecnológico seguro da ata do DDS.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">2</span>
              Quais Dados Coletamos e Por Que?
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border border-slate-800 rounded-2xl overflow-hidden">
                <thead className="bg-slate-950 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 border-b border-slate-800">Dado Coletado</th>
                    <th className="p-3 border-b border-slate-800">Finalidade Operacional</th>
                    <th className="p-3 border-b border-slate-800">Base Legal (LGPD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  <tr>
                    <td className="p-3 font-semibold text-white">Nome Completo</td>
                    <td className="p-3 text-slate-400">Identificação individual na lista de presença do DDS.</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">Art. 7º, II (Obrigação Legal)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Cargo / Função</td>
                    <td className="p-3 text-slate-400">Comprovação de pertinência do tema ao cargo ocupado.</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">Art. 7º, II (Obrigação Legal)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Foto Facial Simples</td>
                    <td className="p-3 text-slate-400">Evidência de presença física em campo durante a instrução.</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">Art. 7º, II (Cumprimento de SST)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Traçado de Assinatura</td>
                    <td className="p-3 text-slate-400">Manifestação de ciência e concordância (Assinatura Simples).</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">Art. 7º, V e Lei 14.063/2020</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Data, Hora e IP</td>
                    <td className="p-3 text-slate-400">Registro temporal e rastreabilidade documental obrigatória.</td>
                    <td className="p-3 text-emerald-400 font-mono text-[11px]">Art. 15 Marco Civil da Internet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">3</span>
              Clarificação Técnica sobre Fotografia Facial (Não Biometria)
            </h2>
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/20 space-y-2">
              <p className="text-slate-300">
                A imagem fotográfica capturada na coleta de presença serve <strong>estritamente como evidência fotográfica simples de presença física</strong> do participante no local do diálogo de segurança.
              </p>
              <p className="text-slate-400 text-xs">
                A plataforma DDS Online <strong>não realiza reconhecimento facial automatizado, extração de vetores matemáticos, mapeamento de pontos nodais nem comparação biométrica 1:N</strong>. Trata-se de uma fotografia documental, enquadrada na base legal de cumprimento de obrigação legal de SST e proteção ao ambiente de trabalho (Art. 7º, II da LGPD c/c NR-1).
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">4</span>
              Compartilhamento e Fornecedores Terceiros
            </h2>
            <p>
              Os dados coletados <strong>nunca são vendidos, alugados ou compartilhados com fins publicitários ou comerciais</strong>. O compartilhamento ocorre exclusivamente com provedores de infraestrutura estritamente necessários para a operação do sistema:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li><strong>Hospedagem e CDN (Vercel Inc.)</strong>: Para entrega rápida e segura das páginas web via protocolo HTTPS/TLS 1.3.</li>
              <li><strong>Banco de Dados Relacional Nuvem</strong>: Armazenamento criptografado em repouso dos dados de atas e assinaturas.</li>
              <li><strong>Sinalização de Vídeo PeerJS</strong>: Sinalização WebRTC temporária apenas para estabelecer sessões remotas ponto-a-ponto, sem retenção de vídeo ou áudio.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">5</span>
              Medidas de Segurança da Informação
            </h2>
            <p>
              Adotamos medidas técnicas e organizacionais compatíveis com os padrões do mercado:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white text-xs flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-400" /> Criptografia Forte
                </p>
                <p className="text-[11px] text-slate-400">Trânsito com TLS 1.3 e repouso com padrão AES-256 no banco de dados.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white text-xs flex items-center gap-1">
                  <Database size={14} className="text-emerald-400" /> Resumo SHA-256
                </p>
                <p className="text-[11px] text-slate-400">Hash criptográfico calculado na finalização para garantir a imutabilidade da ata.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white text-xs flex items-center gap-1">
                  <Lock size={14} className="text-emerald-400" /> Cabeçalhos HTTP
                </p>
                <p className="text-[11px] text-slate-400">Proteções HSTS, X-Content-Type-Options e Referrer-Policy ativadas no servidor.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">6</span>
              Retenção, Custódia e Responsabilidade pelos Documentos
            </h2>
            <p>
              A plataforma <strong>DDS Online atua estritamente como ferramenta tecnológica de coleta e emissão de atas e relatórios de assinaturas em PDF</strong>.
            </p>
            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
              <p className="text-amber-300 font-bold text-xs">
                ⚠️ Responsabilidade Exclusiva do Usuário pelo Armazenamento e Guarda:
              </p>
              <p className="text-slate-300 text-xs leading-relaxed">
                A plataforma <strong>não tem responsabilidade por armazenar indefinidamente esses dados ou fazer a guarda regulamentar de longo prazo</strong>. Uma vez emitido o relatório de assinaturas e evidências em PDF, <strong>a responsabilidade pelo download, custódia, arquivamento, backup e guarda física/digital perante a fiscalização do trabalho, previdência ou auditorias é inteiramente do usuário e da empresa contratante</strong>.
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Registros estritos de logs de conexão a aplicações na internet são mantidos apenas pelo prazo legal de 6 (seis) meses em cumprimento exclusivo ao Artigo 15 da Lei nº 12.965/2014 (Marco Civil da Internet).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 inline-flex items-center justify-center text-xs">7</span>
              Direitos do Titular (Artigo 18 da LGPD) e Canal DPO
            </h2>
            <p>
              Você, na qualidade de titular de dados pessoais, pode exercer seus direitos (confirmação da existência de tratamento, acesso, correção de dados incompletos ou inexatos) entrando em contato prioritariamente com o seu <strong>Empregador (Controlador)</strong>.
            </p>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-bold text-white">Canal do Encarregado de Proteção de Dados (DPO)</p>
                <p className="text-slate-400 text-xs">Para esclarecimentos adicionais sobre a infraestrutura e segurança da plataforma.</p>
              </div>
              <a
                href="mailto:apoioamtst@gmail.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Mail size={14} /> apoioamtst@gmail.com
              </a>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/60 text-xs text-slate-500">
          <div>
            <p>© 2026 <strong>AM TST</strong>. Todos os direitos reservados.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">DDS ON é uma plataforma da AM TST.</p>
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
