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

# Adapter functions

In this paragraph are listet additional functionalities which can be used for an easier implementation in ioBroker to use it with other devices.
- [access_state](#access-state)
- [allow_charging](#allow-chargeing)
- [ampere](#ampere)
- [energy](#energy)
  - [adjustAmpLevelInWatts](#-adjust-the-ampere-level-by-using-watts)
  - [max_watts](#-maximum-watts)
- [max_load](#-max-load)
- settings
  - ampere_level1
  - ampere_level2
  - ampere_level3
  - ampere_level4
  - ampere_level5
  - color
    - idle
    - chargeing
    - finish
  - led_save_energy
  - led_brightness
- [stop_state](#stop-state)

## Access State

| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| [ast](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | mode | go-e.0.access_state |

Access control to select the method to grant access to he device. 
0: open
1: RFID / App needed
2: electricity price / automatic

## Allow Chargeing
| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| [alw](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | mode | go-e.0.allow_charging |

allow_charging: PWM signal may be present
0: no
1: yes

## Ampere
| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| [amp](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.ampere |

This attribute selects the amount of ampere which can be used for loading. 
Ampere value for the PWM signaling in whole ampere of 6-32A.

## Energy
Adjust all settings about the energy. This node is not writable, but it conatins sveral switches
### Maximum Watts  

| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| - | integer | watts | go-e.0.energy.max_watts |

The hardware can adjust, how many ampere are allowed to be used during the load process. Any kind of Photo Voltaic or cunsumption messuring device speaking about Watts and mostly not amperes. To use the amoutn of watts and do the calulation with the connected phases or the connected adapter it has to recalculate to the amperes. 

For this set the `go-e.0.energy.max_watts` (0 is you instance of the adapter) with the maximum allowed amount of watts. 
The update process will be only send to the device every 30 secounds. This setting can be changed within the settings menu, but it is recommed to do it not more often. Some more information in the [official manual](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20DE.md).

## Adjust the ampere level by using watts 
| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| - | integer | watts | go-e.0.energy.adjustAmpLevelInWatts |
If your photo voltaic device are serving just the amout of watts which are currently to mush in your environment, this function can just the ampere level, by handover a number of watts.  
e.g. If you want to give your car loader e.g. more 1000 watts more power just write into that value 1000. The same, if you want to reduce the amout by 1000 watts you have to write here -1000.

The endpoint in this adpter is `go-e.0.energy.adjustAmpLevelInWatts`. The update process will be only send to the device every 30 secounds. This setting can be changed within the settings menu, but it is recommed to do it not more often. 

## Max Load
| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| [dwo](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.max_load |
Shutdown value in kWh if stp==2, for dws parameter

## Settings
This node groups several attributes for general settings. 
The node itself is not writeable.

### Ampere Level 1-5
| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| [al1](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.settings.ampere_level1 |
| [al2](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.settings.ampere_level2 |
| [al3](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.settings.ampere_level3 |
| [al4](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.settings.ampere_level4 |
| [al5](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.settings.ampere_level5 |

Ampere Level 1 for push button on the device.
6-32: Ampere level activated
0: level deactivated (is skipped)
Ampere Level 2 for push button on the device.
Must be either 0 or >al1

## Stop State
| go-e attribute | Type | Unit | Example Attritute position |
| -- | -- | -- | --:|
| [stp](https://github.com/goecharger/go-eCharger-API-v1/blob/master/go-eCharger%20API%20v1%20EN.md) | integer | ampere | go-e.0.stop_state |

Automatic shutdown. Stops the loading Process automated after the giver amount of kWh.
0: deactivated
2: switch off after kWh