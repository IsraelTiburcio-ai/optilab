const variants={
  principal:{file:'optilab-logo-principal.svg',width:2048,height:620},
  wordmark:{file:'optilab-logotipo-color.svg',width:1600,height:350},
  negative:{file:'optilab-logo-negativo.svg',width:2048,height:620},
} as const;

export function BrandLogo({variant='principal',className=''}:{variant?:keyof typeof variants;className?:string}){
  const asset=variants[variant];
  return <img className={`brand-logo ${className}`} src={`${import.meta.env.BASE_URL}brand/svg/${asset.file}`} width={asset.width} height={asset.height} alt="" aria-hidden="true" decoding="async" draggable={false}/>;
}
