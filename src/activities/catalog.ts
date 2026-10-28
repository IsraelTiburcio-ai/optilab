import type {ExternalActivity,PublicActivityPlacement} from './types';
import {validatedActivity} from './urls';
const definitions:readonly ExternalActivity[]=[
  {activityId:'learningapps-formulas-simplex',title:'Fórmulas para el Simplex',provider:'learningapps',resourceId:'pznycxd7t21',
    sourceUrl:'https://learningapps.org/watch?v=pznycxd7t21',embedUrl:'https://learningapps.org/show.php?id=pznycxd7t21',
    capabilities:{completion:'provider-signal',score:'unavailable',academicValidation:'none'},academicStatus:'public-complementary'},
  {activityId:'wordwall-metodo-m-grande',title:'Método de M Grande',provider:'wordwall',resourceId:'cc167dda64954e3dbb379706dd8348c8',
    sourceUrl:'https://wordwall.net/resource/22610275/m%C3%A9todo-de-m-grande',embedUrl:'https://wordwall.net/es/embed/cc167dda64954e3dbb379706dd8348c8?themeId=66&templateId=35&fontStackId=0',
    capabilities:{completion:'unavailable',score:'unavailable',academicValidation:'none'},academicStatus:'public-complementary'},
];
export const publicActivityPlacements:readonly PublicActivityPlacement[]=[
  {activityId:'learningapps-formulas-simplex',gymId:3,status:'published'},
  {activityId:'wordwall-metodo-m-grande',gymId:3,status:'published'},
];
/** This is exclusively a public catalog. Never ship private definitions here and
 * then attempt to authorize them by hiding their cards. Group publishing is #5/#6. */
export function publicActivity(activityId:string,placements=publicActivityPlacements):{activity:ExternalActivity;placement:PublicActivityPlacement}|null {
  const placement=placements.find(p=>p.activityId===activityId&&p.status==='published');
  const definition=definitions.find(a=>a.activityId===activityId&&a.academicStatus==='public-complementary');
  if(!placement||!definition)return null;const activity=validatedActivity(definition);return activity?{activity,placement}:null;
}
export const publicGymActivities=(gymId:number)=>publicActivityPlacements.filter(p=>p.gymId===gymId).map(p=>publicActivity(p.activityId)).filter((p):p is NonNullable<typeof p>=>!!p);
export const providerName={learningapps:'LearningApps',wordwall:'Wordwall'} as const;
