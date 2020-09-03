#!/bin/bash
find "$(pwd)/rst" -type f \( -name "*.png" -o -name "*.jpg" \) -print0 | while read -d $'\0' f
do
	if ! [[ "$f" == *_256.png ]]
	then
		base="${f%%.*}"
		printf "converting ${f} \n"
		convert -geometry 256x ${f} "${base}_256.png"
	else
		echo "$f" was already resized
	fi
done
echo All done!
