#!/bin/bash
# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/home/ubuntu/miniconda3/bin/conda' 'shell.bash' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/home/ubuntu/miniconda3/etc/profile.d/conda.sh" ]; then
        . "/home/ubuntu/miniconda3/etc/profile.d/conda.sh"
    else
        export PATH="/home/ubuntu/miniconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<
cd /home/ubuntu/apps/hydroviewer_brazil/tethysapp/hydroviewer_brazil/scripts
conda activate tethys && python /home/ubuntu/apps/hydroviewer_brazil/tethysapp/hydroviewer_brazil/scripts/cache.py >> /home/ubuntu/apps/hydroviewer_brazil/tethysapp/hydroviewer_brazil/scripts/out.txt 2>&1
