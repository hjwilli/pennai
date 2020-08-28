"""This file is part of the PennAI library.

Copyright (C) 2017 Epistasis Lab, University of Pennsylvania

PennAI is maintained by:
    - Heather Williams (hwilli@upenn.edu)
    - Weixuan Fu (weixuanf@pennmedicine.upenn.edu)
    - William La Cava (lacava@upenn.edu)
    - and many other generous open source contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
import pandas as pd
from glob import glob
import sys

mf_name = sys.argv[1]
if len(sys.argv) > 2: # then kb specified
    kb_name = [sys.argv[2]]
else:
    kb_name = glob('*.tsv.gz')
print('mf_name:',mf_name)
print('kb_name:',kb_name)
# get metafeatures
mf_df = pd.read_csv(mf_name,compression='gzip')
mf_df.rename(columns={'Unnamed: 0':'dataset'},inplace=True)

dataset_to_id = mf_df[['dataset','_id']].set_index('dataset').to_dict()['_id']
import pdb

# loop thru data
# for each dataset, add id column and resave
for f in kb_name:
    print(f)
    df = pd.read_csv(f,sep='\t',compression='gzip')
    print('mapping ids...')
    # pdb.set_trace()
    df['_id'] = df['dataset'].apply(lambda x: dataset_to_id[x] 
            if x in dataset_to_id.keys() else 'MISSING')
    print('missing ids for these datasets:',
          df.loc[df['_id'] == 'MISSING']['dataset'].unique()
          )
    df = df.loc[df['_id'] != 'MISSING']

    df.to_csv('new/'+f,index=None,
            sep='\t',compression='gzip')


# for f in glob('test/results/*.tsv'):
#     print(f)
#     df = pd.read_csv(f,sep='\t')
#     print('mapping ids...')
#     # pdb.set_trace()
#     df['_id'] = df['dataset'].apply(lambda x: dataset_to_id[x] 
#             if x in dataset_to_id.keys() else 'MISSING')
#     print('missing ids for these datasets:',
#           df.loc[df['_id'] == 'MISSING']['dataset'].unique()
#           )
#     df = df.loc[df['_id'] != 'MISSING']

#     df.to_csv('test/results/new/'+f.split('results/')[-1],index=None,
#             sep='\t')

