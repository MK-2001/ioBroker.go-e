# Functionalities

## General 
This adapter collects the data via the http API from your e-GoCharger over Wifi. 

## Adapter functions

In this paragraph are listet additional functionalities which can be used for an easier implementation in ioBroker to use it with other devices.

### Maximum Watts
The hardware can adjust, how many ampere are allowed to be used during the load process. Any kind of Photo Voltaic or cunsumption messuring device speaking about Watts and mostly not amperes. To use the amoutn of watts and do the calulation with the connected phases or the connected adapter it has to recalculate to the amperes. 

For this set the `go-e.0.energy.max_watts` (0 is you instance of the adapter) with the maximum allowed amount of watts. 
The update process will be only send to the device every 30 secounds. This setting can be changed within the settings menu, but it is recommed to do it not more often. 

### Adjust the ampere level by using watts (adjustAmpLevelInWatts)
If your photo voltaic device are serving just the amout of watts which are currently to mush in your environment, this function can just the ampere level, by handover a number of watts.  
e.g. If you want to give your car loader e.g. more 1000 watts more power just write into that value 1000. The same, if you want to reduce the amout by 1000 watts you have to write here -1000.

The endpoint in this adpter is `go-e.0.energy.adjustAmpLevelInWatts`. The update process will be only send to the device every 30 secounds. This setting can be changed within the settings menu, but it is recommed to do it not more often. 