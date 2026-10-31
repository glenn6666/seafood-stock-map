# 把店面圖招牌「釣蝦挑戰」改字（座標為 1080×720 原圖）：inpaint 去原字 → 霞鶩文楷依原字位置／斜度重寫
import cv2,numpy as np,sys
from PIL import Image,ImageDraw,ImageFont,ImageFilter
TEXT=sys.argv[1] if len(sys.argv)>1 else "樂甜釣蝦"
OUT=sys.argv[2] if len(sys.argv)>2 else "/workspace/game-art-src/comic-market-sign.png"
S=6
src=Image.open('/workspace/game-art-src/comic-market-orig.webp').convert('RGB')
CEN=[(857,90.5),(880,96.5),(906.5,102.5),(929,109)]   # 原字中心
SIZE=24  # 原字大小 px
x0,y0,x1,y1=835,70,955,130
big=np.array(src.crop((x0,y0,x1,y1)).resize(((x1-x0)*S,(y1-y0)*S),Image.LANCZOS))
P=lambda x,y:((x-x0)*S,(y-y0)*S)
# 文字區（沿斜度的平行四邊形）
poly=np.array([P(842,76),P(944,95),P(944,124),P(842,104)],np.int32)
area=np.zeros(big.shape[:2],np.uint8);cv2.fillPoly(area,[poly],255)
lum=big.astype(int).sum(2);m=((lum>330)&(area>0)).astype(np.uint8)*255
col=(226,206,163);print("colour",col)
m=cv2.dilate(m,np.ones((2*S,2*S),np.uint8))
clean=cv2.inpaint(big,m,4*S,cv2.INPAINT_TELEA)
# 去除 inpaint 塗抹感：加一點原本木板/黑板的雜訊
noise=np.random.default_rng(1).normal(0,5,clean.shape);clean=np.where(m[...,None]>0,np.clip(clean+noise,0,255),clean).astype(np.uint8)
img=Image.fromarray(clean).convert('RGBA')
ang=np.degrees(np.arctan2(CEN[-1][1]-CEN[0][1],CEN[-1][0]-CEN[0][0]))
font=ImageFont.truetype('/home/box/.fonts/LXGWWenKaiTC-Medium.ttf',int(SIZE*S*0.95))
for ch,(cx,cy) in zip(TEXT,CEN):
  t=Image.new('RGBA',(SIZE*S*2,SIZE*S*2),(0,0,0,0));c=(t.width/2,t.height/2)
  sh=Image.new('RGBA',t.size,(0,0,0,0));ImageDraw.Draw(sh).text((c[0]+S,c[1]+S*1.2),ch,font=font,fill=(5,15,25,170),anchor="mm",stroke_width=S//3,stroke_fill=(5,15,25,170));sh=sh.filter(ImageFilter.GaussianBlur(S*0.7))
  ImageDraw.Draw(t).text(c,ch,font=font,fill=col+(255,),anchor="mm",stroke_width=S//3,stroke_fill=col+(255,))
  t=Image.alpha_composite(sh,t).rotate(-ang,resample=Image.BICUBIC)
  px,py=P(cx,cy);img.alpha_composite(t,(int(px-t.width/2),int(py-t.height/2)))
img=img.convert('RGB').filter(ImageFilter.GaussianBlur(S*0.35)).resize((x1-x0,y1-y0),Image.LANCZOS)
mask=Image.new('L',img.size,0);ImageDraw.Draw(mask).polygon([(p[0]/S,p[1]/S) for p in [P(839,72),P(947,92),P(947,128),P(839,108)]],fill=255);mask=mask.filter(ImageFilter.GaussianBlur(1.5))
out=src.copy();out.paste(img,(x0,y0),mask);out.save(OUT)
crop=lambda im:im.crop((780,40,1000,140)).resize((660,300),Image.LANCZOS)
pair=Image.new('RGB',(660,620),'white');pair.paste(crop(src),(0,0));pair.paste(crop(out),(0,320));pair.save('/workspace/screens-fullmap2/sign-before-after.png')
