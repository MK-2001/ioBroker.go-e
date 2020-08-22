# Functionalities

## General 
This adapter collects the data via the http API from your e-GoCharger over Wifi. 

## Installation
You can just add a instance to ioBroker with the go-e Adapter

## Configuration of the Hardware
To enable the Adapter you must activate the http-interface via the app.
1. Connect the mobile device with the hotspot WIFI of the Hardware
1. Open the go-eCharger App
1. go to Cloud 
1. Advanced Settings (erweiterte Einstellungen)
1. Activate HTTP Interface

## Configuration of the ioBroker Adapter
- Server or IP-Address  
 Please enter here the Hostname or the IP-Adress to connect to the go-eCharger. By default the go-eCharger registers with the given hostname.

- Service Update intervall  
Defines in wich intervall will the status requested from the adpater. Recommed 30 secs. Supplier recommed a minimum of 5 secs

-  Update Intervall for Updated  
Defines how ofter should the adapter allow to reconfigure e.g. maxAmpere. To often configuration could destroy the Hardware and the car!

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