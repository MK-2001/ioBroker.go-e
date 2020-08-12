# Functionalities

## General 
This adapter collects the data via the http API from your e-GoCharger over Wifi. 

## Adapter functions

In this paragraph are listet additional functionalities which can be used for an easier implementation in ioBroker to use it with other devices.

### Maximum Watts
The hardware can adjust, how many ampere are allowed to be used during the load process. Any kind of Photo Voltaic or cunsumption messuring device speaking about Watts and mostly not amperes. To use the amoutn of watts and do the calulation with the connected phases or the connected adapter it has to recalculate to the amperes. 

For this set the `go-e.0.electricity_exchange.max_watts` (0 is you instance of the adapter) with the maximum allowed amount of watts. 
The update process will be only send to the device every 30 secounds. This setting can be changed within the settings menu, but it is recommed to do it not more often. 
