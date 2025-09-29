!/bin/bash

cd /scripts

##############################作者昵称（必填）##############################
# 使用空格隔开
author_list="Tartarus2014 i-chenzhe whyour moposmall qq34347476 shylocks"

##############################作者脚本地址URL（必填）##############################
# 例如：https://raw.githubusercontent.com/whyour/hundun/master/quanx/jx_nc.js
# 1.从作者库中随意挑选一个脚本地址，每个作者的地址添加一个即可，无须重复添加
# 2.将地址最后的 “脚本名称+后缀” 剪切到下一个变量里（my_scripts_list_xxx）
scripts_base_url_1=https://raw.githubusercontent.com/Tartarus2014/Script/master/
scripts_base_url_2=https://raw.githubusercontent.com/i-chenzhe/qx/main/
scripts_base_url_3=https://raw.githubusercontent.com/whyour/hundun/master/quanx/
scripts_base_url_4=https://raw.githubusercontent.com/moposmall/Script/main/Me/
scripts_base_url_5=https://gitee.com/qq34347476/quantumult-x/raw/master/
scripts_base_url_6=https://gitee.com/shylocks/updateTeam/blob/main/

##############################作者脚本名称（必填）##############################
# 将相应作者的脚本填写到以下变量中
my_scripts_list_1=""
my_scripts_list_2=""
my_scripts_list_3=""
my_scripts_list_4=""
my_scripts_list_5="format_share_jd_code.js"
my_scripts_list_6=""

##############################是否使用本地代理(选填)#############################
Enableproxy="false"
##############################随机函数##########################################
rand(){
    min=$1
    max=$(($2-$min+1))
    num=$(cat /proc/sys/kernel/random/uuid | cksum | awk -F ' ' '{print $1}')
    echo $(($num%$max+$min))
}


index=1

for author in $author_list
do
  echo -e "####################开始下载 $author 的脚本####################"
  # 下载my_scripts_list中的每个js文件，重命名增加前缀"作者昵称_"，增加后缀".new"
  eval scripts_list=\$my_scripts_list_${index}
  echo $scripts_list
  eval url_list=\$scripts_base_url_${index}
  for js in $scripts_list
  do
    eval url=$url_list$js
    echo $url
    check_file=`ls|grep "$js"`
    if [ ! $check_file ]; then
      check_file="blank"
    fi
    existing_file_num=`echo "$check_file"|awk 'END{print NR}'`
    if [[ "$existing_file_num" -eq "1" ]] && [ ${check_file} == ${js} ]; then
      echo -e "库中已存在该脚本 $js ,将不进行任何操作"
      continue
    else
      if [ ${check_file} == "blank" ]; then
        eval name=$author"_"$js
        echo $name"--发现新脚本"
      else
        for js_name in $check_file
        do
          if [ ${js_name} != ${js} ] && [[ "$existing_file_num" -gt "1" ]]; then
            rm -f "$js_name"
            echo -e "已删除一个重复的 $js 脚本"
          else
            eval name=$author"_"$js
            echo $name"--只发现1个脚本，故继续保留作者前缀"
          fi
        done
      fi

    # wget下载是否使用代理
    if [ "${Enableproxy}" = "true" ]; then
        echo -e "使用代理下载"
        wget -q -e "https_proxy=http://192.168.50.1:3333" --no-check-certificate $url -O $name.new
    else
        echo -e "不使用代理下载"
        wget -q --no-check-certificate $url -O $name.new
    fi

    # 如果上一步下载没问题，才去掉后缀".new"，如果上一步下载有问题，就保留之前正常下载的版本
      if [ $? -eq 0 ]; then
        mv -f $name.new $name
        echo -e "更新 $name 完成..."
	    croname=`echo "$name"|awk -F\. '{print $1}'`
	    script_date=`cat  $name|grep "http"|awk '{if($1~/^[0-59]/) print $1,$2,$3,$4,$5}'|sort |uniq|head -n 1`
	    cron_path="/scripts/docker/merged_list_file.sh"
	    echo_content="${script_date}  node /scripts/$name >> /scripts/logs/$croname.log 2>&1"
	    [ -z "${script_date}" ] && script_date=`cat  $name|grep -Eo "([0-9]+|\*) ([0-9]+|\*) ([0-9]+|\*) ([0-9]+|\*) ([0-9]+|\*)"|sort |uniq|head -n 1`
	    if [ -z "${script_date}" ]; then
	      cron_min=$(rand 1 59)
	      cron_hour=$(rand 7 9)
	  	  [ $(grep -c "$croname" /jd/config/crontab.list) -eq 0 ] && echo "$echo_content" >> "$cron_path"
	    else
	      check_existing_cron=`grep -c "$croname" /jd/config/crontab.list`
	      echo $check_existing_cron"准备添加cron"
	      if [ "${check_existing_cron}" -eq 0 ]; then
	        echo "$echo_content" >> "$cron_path"
	        echo -e "已成功添加新cron...\n"
	      else
	        grep -v "$croname" $cron_path > output.txt
		      mv -f output.txt "$cron_path"
		      echo "$echo_content" >> "$cron_path"
	        echo -e "已成功替换cron...\n"
	      fi
	    fi
      else
        [ -f $name.new ] && rm -f $name.new
        echo -e "更新 $name 失败，使用上一次正常的版本...\n"
      fi
    fi
  done
  index=$[$index+1]
done

#if [ ! -d "/diy_js/"  ];then
#  echo "未检查到diy_js文件夹，初始化下载相关脚本"
#  mkdir diy_js
#  cd /diy_js
#  else
#  echo "已存在diy_js文件夹，将更新相关脚本"
#  cd /diy_js
#fi

####### 对于大佬库中以jd_、jx_开头的js，不添加作者昵称前缀，直接用原文件名，防止脚本重复#######
#    if [ ${js:0:3} != "jd_" ] && [ ${js:0:3} != "jx_" ]; then
#      eval name=$author"_"$js
#	  echo $name"--原始脚本名不是jd_或jx_开头，已添加作者前缀"
#    else
#	  eval name=$js
#	  echo $name"--原始脚本名以jd_或jx_开头，无需添加作者前缀"
#    fi
