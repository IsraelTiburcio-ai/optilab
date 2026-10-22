/** Five original vector scenes, keyed to the real activities rather than list order. */
export function SimplexCover({repo}: {repo: string}) {
  if (!['memorama-simplex','rompecabezas-simplex','ahorcado-simplex','ordena-simplex','caza-el-pivote'].includes(repo)) return null;
  return <svg className="simplex-cover" viewBox="0 0 360 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="360" height="170" fill="#d7e8e8"/>
    <path d="M0 144 55 116 95 134 150 97 210 134 285 106 360 132V170H0Z" fill="#acc8c2"/>
    <g stroke="#304e57" strokeWidth="3" strokeLinejoin="round">
      {repo === 'memorama-simplex' && <>
        <path d="M80 66 118 39l43 23-37 30Z" fill="#e6bc6c"/>
        <rect x="102" y="50" width="62" height="83" rx="9" transform="rotate(-14 133 91)" fill="#fff5d6"/>
        <rect x="203" y="50" width="62" height="83" rx="9" transform="rotate(14 234 91)" fill="#527b8c"/>
        <path d="m119 86 15-17 15 17-15 18Z" fill="#e6bc6c"/><path d="m218 86 15-17 15 17-15 18Z" fill="#e6bc6c"/>
        <path d="M171 82q13-15 25 0m-24 15q12 14 24 0" fill="none" strokeDasharray="4 4"/>
      </>}
      {repo === 'rompecabezas-simplex' && <>
        <path d="M103 47h57v19q25-15 25 9t-25 10v29h-57V94q-24 12-24-8t24-8Z" fill="#e6bc6c"/>
        <path d="M197 66h55v66h-55v-22q-26 14-26-9t26-9Z" fill="#527b8c"/>
        <path d="M120 63v36m-10-18h21m81 2h25m-25 12h25" fill="none"/>
        <path d="m271 50 12 12-12 12" fill="none" stroke="#a35a40"/>
      </>}
      {repo === 'ahorcado-simplex' && <>
        <path d="M94 135V49h36m-47 88h61" fill="none"/>
        <path d="M123 45h127v81H123Z" fill="#fff4d7"/>
        <path d="M146 66h15v19h-15Zm34 0h15v19h-15Zm34 0h15v19h-15Z" fill="#e6bc6c"/>
        <path d="M145 105h18m14 0h18m14 0h18" fill="none"/>
        <path d="m268 71 13-12 12 15-18 40-14 4-1-15Z" fill="#a35a40"/>
      </>}
      {repo === 'ordena-simplex' && <>
        <path d="M85 132h58v-22h58V87h58V59h29" fill="none" strokeWidth="6"/>
        <rect x="88" y="83" width="37" height="29" rx="5" fill="#fff4d7"/>
        <rect x="148" y="59" width="37" height="29" rx="5" fill="#e6bc6c"/>
        <rect x="208" y="33" width="37" height="29" rx="5" fill="#527b8c"/>
        <path d="m135 62 9-11-14-3m64-11 10-11-15-3M282 61V22l24 10-24 10" fill="#a35a40"/>
        <path d="M106 92v11m55-35h10v6h-10v6h10m52-37h9v15h-9m0-8h9" fill="none"/>
      </>}
      {repo === 'caza-el-pivote' && <>
        <rect x="100" y="40" width="145" height="93" rx="7" fill="#fff4d7"/>
        <path d="M100 71h145m-145 31h145m-97-62v93m48-93v93" fill="none"/>
        <path d="M148 41h48v91h-48Z" fill="#7ba4a6" opacity=".35" stroke="none"/>
        <circle cx="172" cy="87" r="25" fill="#e6bc6c" fillOpacity=".7"/>
        <path d="M172 52v20m0 29v20m-34-34h20m28 0h20m-34-7v14" fill="none"/>
        <path d="m255 67 30 19-30 19m-9-19h39" fill="none" stroke="#a35a40"/>
      </>}
    </g>
    <g fill="#fff6d8"><path d="m64 51 4-8 4 8 8 4-8 4-4 8-4-8-8-4Z"/><circle cx="306" cy="125" r="4"/></g>
  </svg>;
}
