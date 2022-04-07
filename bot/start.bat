@echo off
title Minecraft server
cd ../server
java -Xmx1024M -Xms1024M -jar server.jar nogui
exit